**Challenge link:** https://ctf.hacker101.com/ctf

Getting to this challenge we can see that we can do the following:

1. View page
2. Edit page
3. Create page

Any time I have the option to provide user input that might get reflected back I try to inject some HTML and Javascript. Turns out this was all that was needed for the first two flags.

## Flag 1

The first flag only requires us to create a new page with a title containing HTML tags. The steps taken were:

1. New page
2. Choose a title like `<b>Hello</b>` or your favourite HTML tag
3. Go back to the main page and we will receive an alert with the first flag

## Flag 2

I tried to add `<script>` tags to the body of a page without success, but It seems like our CMS supports `Markdown`, which is interesting. 

Going to the post of name `Markdown Test` and going to `Edit this page` we see that we can add buttons and links to our posts. The button element usually has handles like `onclick`, so I went ahead and added `onclick="alert(1)"` to the button. 

After saving the page and trying to click on the button the alert did not fire, so I went to the source code to see if it was escaped and I saw that a new flag got appended as an attribute of my button. Pretty neat!

## Flag 3

At this point we got HTML injection and XSS. On easier challenges it's pretty common for us to also have SQL injections. My first test was to add a single quotes to `/page/1'`, but we get a `404`.

There's one more place that accepted an `ID` though, the `/page/edit/<page_number>` endpoint. Hitting `/page/edit/1'`  gets us another flag!

## Flag 4

Seeing the page IDs and no authorization at all made me try to enumerate page IDs, and sure enough we get a new and the last flag this way. Here was my approach:

1.  Create a sequence of numbers and persist those in a file: `seq 20 > range.txt`
2. Scan all these numbers:
	1. `ffuf -w range.txt https://<subdomain>.ctf.hacker101.com/page/FUZZ`

We get:

```
1                       [Status: 200, Size: 239, Words: 12, Lines: 15]
4                       [Status: 403, Size: 234, Words: 27, Lines: 5]
11                      [Status: 200, Size: 253, Words: 8, Lines: 14]
2                       [Status: 200, Size: 433, Words: 19, Lines: 16]
:: Progress: [20/20] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:00] :: Errors: 0 ::
```

Page 1 and 2 are the default pages when we create our challenge, page `11` is the page I've created when we got out first flag. Among those numbers we never interacted with page number 4, but notice how the status of page 4 is being returned as `403` when we try to access `page/4`.

Turns out we can also bypass this by going to the `/page/edit/4` endpoint and we get our flag.

This challenge is a great introduction to common CTF themes. I particularly liked thay the `GET /page/4` endpoint was protected, but `/page/edit/4` wasn't since it's a common issue even in enterprise level systems when they are not following secure by default practices.

Thanks for reading and I will see you in our next post!