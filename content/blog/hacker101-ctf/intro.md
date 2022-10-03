---
title: Hacker101 CTF and Micro-CMS v1 walkthrough
date: "2022-09-29T09:30:00.284Z"
description: "Introduction to the Hacker101 CTF through the Micro-CMS v1 challenge"
---

This will be a new series of posts about the [Hacker101 CTF](https://ctf.hacker101.com/about). I will be going through the challenges in the order they are presented in the site and explaining how I solved them and what was going through my mind as I approached each challenge. I will mostly focus on the web, crypto and math challenges, but an occasional misc challenge might sneak in.

The goal of CTFs in general is to uncover flags, which are hidden in the challenges and have the format `^FLAG^...$FLAG$`. With that out of the way, let's begin with the first challenge called `Micro-CMS v1`.

## Micro-CMS v1

This is an easy challenge containing four flags with the goal of teaching you some common web vulnerabilities. 

When I jump into a challenge I like to start by manually investigating what is possible within the constraints of the user interface. In this case the challenge is a simple CMS with the following features:

1. View page
2. Edit page
3. Create page

Any time I have the option to provide user input that might get reflected back to another user I try to inject some HTML and Javascript. This prompted me to first try to create a page.

### Flag 1

The first flag only requires us to create a new page with a title containing HTML tags. The steps taken were:

1. New page
2. Choose a title like `<b>Hello</b>` or your favourite HTML tag
3. Go back to the main page and we will receive an alert with the first flag

### Flag 2

I tried to also add `<script>` tags to the body of a page without success, but exploring the other existing pages gives us the hint that our CMS supports `Markdown`, which we might be able to use to create HTML components with some javascript. 

Going to the post with the name `Markdown Test` and clicking on `Edit this page` we see that we can add buttons and links to our posts. The button element usually has handles like `onclick`, so I went ahead and added `onclick="alert(1)"` to the button. 

After saving the page and trying to click on the button the alert did not fire, so I went to the source code to see what was wrong and I noticed that a new flag was appended as an attribute of my button. Pretty neat!

### Flag 3

At this point we got HTML injection and XSS. Another common web vulnerability is called [SQL injection](https://owasp.org/www-community/attacks/SQL_Injection), or `SQLi`. This usually happens on endpoints that accept a parameter like an `ID` or a similar identifier, but can also be found on any endpoints accepting user input. In our CMS we have two locations accepting identifiers:

- `/page/:id`
- `/page/edit/:id`

 My first test was to add a single quote to `/page/1'`, but we get `404` as a response code. This implies the endpoint is correctly escaping our user input. Don't be discouraged when the first few endpoints are not vulnerable to the attack you are trying to perform, it's pretty common that developers overlook something in a bigger web application.

In our case hitting `/page/edit/1'` with the same payload gets us another flag, which proves that the endpoint was vulnerable to SQL injection.

### Flag 4

There's another common vulnerability on endpoints that accept identifiers called [Insecure Direct Object Reference](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html), commonly abbreviated to `IDOR`. Seeing the page IDs and no authorization in place makes me want to try and enumerate the web application for other IDs. Here's the approach I took:

1. Create a sequence of numbers, for example, 1 to 20 and persist those in a file: `seq 20 > range.txt`
2. Scan all these numbers, I've used [ffuf](https://github.com/ffuf/ffuf) to do it:
	1. `ffuf -w range.txt https://<subdomain>.ctf.hacker101.com/page/FUZZ`

We get as a result:

```bash
1    [Status: 200, Size: 239, Words: 12, Lines: 15]
4    [Status: 403, Size: 234, Words: 27, Lines: 5]
11   [Status: 200, Size: 253, Words: 8, Lines: 14]
2    [Status: 200, Size: 433, Words: 19, Lines: 16]

:: Progress: [20/20] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Errors: 0 ::
```

Page 1 and 2 are the default pages when we create our challenge, page `11` is the page I've created when we got our first flag. Among those numbers we never interacted with page number `4`, but notice how the status of page 4 is being returned as `403` when we try to access `page/4`.

Turns out we can also bypass this by going to the `/page/edit/4` endpoint and we get our last flag.

### Conclusion

This challenge is a great introduction to common CTF themes. I particularly liked that the `GET /page/4` endpoint was protected, but `/page/edit/4` wasn't since this is a common issue even in enterprise level systems when they are not following secure by default practices.

Thanks for reading and I will see you in our next post!
