---
title: Cody's First Blog writeup
date: "2022-10-24T09:30:00.284Z"
description: "Writeup for the Hacker101 CTF challenge Cody's First Blog"
---
This is the next challenge from [Hacker101 CTF](https://ctf.hacker101.com/) after `Photo Gallery`. This is a web challenge rated as moderate.

## Introduction

This seems to be a small service that allows someone to add a comment that will later be reviewed by someone. This is further validated by the message that we receive after posting a comment:

```md
Comment submitted and awaiting approval!
```

The main page also has an interesting snippet:

```md
First post! I built this blog engine around one basic concept:
PHP doesn't need a template language because it is a template language.
This server can't talk to the outside world and nobody but me can upload files,
so there's no risk in just using include().
```

So we know this server is running PHP and inspecting network requests confirms our theory, we are running:

```md
Server: openresty/1.21.4.1
x-powered-by: PHP/5.5.9-1ubuntu4.24
```

Before trying to exploit anything it's always worth doing some more recon, in this case reading the source code of the page gives us another good hint:

```html
<!--<a href="?page=admin.auth.inc">Admin login</a>-->
```

Going to `https://<subdomain>.ctf.hacker101.com/?page=admin.auth.inc` displays a simple login page.

At this point I have a few thoughts on my mind:
1. Can we inject PHP on the comment form?
2. Can we exploit this `page` parameter in the URL to access other pages? The hint about `include` seems relevant here.
3. Can we obtain the cookies from an admin through XSS that is injected in a comment that will be later reviewed?
4. Can we use SQL injection to bypass the login or dump the database?

## First flag

Let's create a post with the following contents to see if we can inject PHP:

```php
<?php echo "test" ?>
```

And submitting it yields our first flag!

```php
^FLAG^<flag>$FLAG$

Comment submitted and awaiting approval!

Go back
```

We can't see the contents of the comment because it's still awaiting approval, so maybe we will need to login as admin at some point. Before we do that though let's try to abuse the `page` parameter in the URL.

## Playing with the page parameter

Let's give the `page` a file name that we know exists like `page=/etc/passwd`. Doing so yields the following error message:

```php
Warning: include(/etc/passwd.php): failed to open stream: No such file or directory in /app/index.php on line 21
  
Warning: include(): Failed opening '/etc/passwd.php' for inclusion (include_path='.:/usr/share/php:/usr/share/pear') in /app/index.php on line 21
```

This is a lot of good information since we now know where the application lives in the filesystem and also the file that loads the main page. We also know that whatever we give to the page parameter will try to be loaded as a file. Finally, we see that the `.php` extension is being added to the parameter we provided. Can we somehow bypass this with a __NULL byte terminator__ (%00)?

When we try to access `/etc/passwd%00` we don't receive the warning that the file doesn't exist, but we receive:

```php
Notice: Undefined variable: title in /app/index.php on line 30

Warning: include(): Failed opening '/etc/passwd' for inclusion (include_path='.:/usr/share/php:/usr/share/pear') in /app/index.php on line 21
```

So our theory was correct, we can bypass the `.php` extension by using a __NULL byte terminator__ (%00). At this point we might be able to enumerate valid files using something like `ffuf`, but let's explore our login page beforehand.

## Admin access and second flag

Our first check is to see if our login is vulnerable to SQL Injection, but trying variations of `a' OR 1=1; --` in our `Username` or `Password` doesn't leak anything. Independently of what we send we always receive the same message:

```php
Incorrect username or password
```

At this point I'm convinced that we should enumerate pages using `ffuf` and see if we can find anything interesting:

```bash
ffuf -w /usr/share/wordlists/dirbuster/directory-list-2.3-small.txt -u https://<subdomain>.ctf.hacker101.com/?page=FUZZ -e ".php,.inc" -fr "Undefined"

home.inc     [Status: 200, Size: 949, Words: 109, Lines: 27]
index        [Status: 200, Size: 158, Words: 22, Lines: 3]
admin.inc    [Status: 200, Size: 805, Words: 33, Lines: 31]
...
```

A few things to note here:

1. We are searching for `.php` and `.inc` file extensions with the `-e` flag.
2. We know that when a file doesn't exist we receive a response with `Notice: Undefined variable: title in /app/index.php on line 30`, so we are filtering out those results with the `-fr` flag.
3. What is this **admin.inc** file?!

Trying to access `https://<subdomain>.ctf.hacker101.com/?page=admin.inc` actually allows us to become admin! Not only that, right at the bottom of the page we can see our second flag!

```php
Admin flag is ^FLAG^<flag>$FLAG$
```

We also see our previous comment that we posted with the PHP code waiting for approval!

## Third flag

After approving our pending comment and going back to the main page we can't see our comment. Inspecting the HTML shows why: 

```php
<p><!--?php echo "test" ?--></p>
```

Our comment is being HTML escaped! How can we make our comments actually run PHP code?

## Loading from localhost

I got lucky here and remembered that PHP has a configuration directive called [allow_url_include](https://beaglesecurity.com/blog/vulnerability/allow-url-fopen-is-enabled.html) that allows us to load files from a URL as opposed to a local file path. This is a dangerous directive that should rarely be enabled in production, but it's enabled in this challenge. We can use this to load files from our localhost and bypass the HTML escaping.

Calling `https://<subdomain>.ctf.hacker101.com/?page=http://localhost/index` actually makes our `echo 'test'` output `test` to the page. This works because we are forcing the server to interpret PHP twice. This might not be obvious at a first glance, so let's try to explain things step by step:

1. We request `https://<subdomain>.ctf.hacker101.com/?page=http://localhost/index` to the server
2. The server starts interpreting our `index.php` page
3. We reach the `include` statement that causes a second request to the server in the form of `http://localhost/index`. Notice that this request doesn't have the `page` parameter, which will prevent us from hitting an infinite loop.
4. This second request will return our comments, which contains: `<?php echo 'test' ?>`
5. This gets returned to the main request, which now contains our comments. These comments are now interpreted as PHP code since they are part of the main page.

Now that we are able to execute PHP code we can start reading files from our server. Let's create a comment with the following contents:

```php
<?php echo file_get_contents('index.php') ?>
```

Now we do:

1. Go to `?page=admin.inc` and approve our comment
2. Load `?page=http://localhost/index`
3. Inspect the HTML
4. Get our third and last flag!

```php
// ^FLAG^<flag>$FLAG$
mysql_connect("localhost", "root", "");
mysql_select_db("level4");
$page = isset($_GET['page']) ? $_GET['page'] : 'home.inc';
if(strpos($page, ':') !== false && substr($page, 0, 5) !== "http:")
  $page = "home.inc";

if(isset($_POST['body'])) {
// ...
```

## Conclusion

This was a fun challenge that required a bit of PHP knowledge, enumeration and taught us about the dangers of `allow_url_include`. I'm not sure how realistic the `admin.auth.inc` to `admin.inc` is, but allowing it to be found through enumeration was a fun touch.

Thanks for reading and I will see you in our next post!
