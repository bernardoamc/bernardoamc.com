---
title: Memory leak in Rack middlewares
date: "2022-03-03T11:35:00.284Z"
description: "How a memory leak within one of our middlewares exposed user sessions across requests."
---

Earlier this month we received a report in our Bug Bounty program claiming that user sessions were being leaked when a request was made with an invalid JSON body. We were skeptical at first, but to our surprise we managed to replicate the report! What is going on? This post aims to summarize our findings and hopefully save other teams some time and trouble in the long run.

## Scenario

Every new request with an invalid JSON body would expose one or more `Set-Cookie` headers in our responses, sometimes from sessions you did not own yourself.

**Request**

```
POST /graphql HTTP/1.1
Host: service.com
Accept: */*
Content-Type: application/json
Content-Length: 18

{
  broken JSON
```

**Response**

```
HTTP/1.1 400 Bad Request
Date: Thu, 03 Feb 2022 12:24:48 GMT
Content-Type: text/plain
...
Set-Cookie: _service_session=<value1>; path=/; expires=Fri, 04 Feb 2022 08:38:48 GMT; secure; HttpOnly; SameSite=Lax; SameSite=None;
Set-Cookie: _service_session=<value2>; path=/; expires=Fri, 04 Feb 2022 11:56:03 GMT; secure; HttpOnly; SameSite=Lax; SameSite=None; 
...

Bad Request
```
Response with multiple `Set-Cookie` headers, which shouldn't happen in our case.

## Context

Our app was built using [Rails](https://rubyonrails.org/) and runs on [Puma](https://github.com/puma/puma).

In order to understand the issue we need to make a detour and talk about [Rack](https://github.com/rack/rack) in a very hand-wavy way. Rack provides an API for:

1. Web servers, which is Puma in our scenario
2. Web frameworks, which is Rails
3. Middlewares, which is code that runs in-between our web server and our framework

Since every part of our workflow uses the same API we can _chain_ our calls from a request to a response. This can be roughly visualized as:

```
Request
  -> Web Server
    -> Middleware 1
      -> ...
        -> Middleware N
          -> Web Framework
        <- Middleware N
      <- ...
    <- Middleware 1
  <- Web server
Response
```
<br />

It's worth reiterating that middlewares can be chained, and they respect the same API. The return of each middleware has the following format:

```ruby
[
  <http_status>,
  { <Hash containing headers> },
  [ <Array containing the response body> ]
]
```

For example:

```ruby
[200, {"Content-Type" => "text/plain"}, ["Hello!"]]
```
<br />

This should be enough to understand our bug. If you would like to know more about Rack and how middleware works I recommend starting [here](https://www.rubyguides.com/2018/09/rack-middleware/).

## Spot the bug

A simplified view of the middleware chain in our application can be represented as:

```
Request
  -> Web Server
    -> Authorization::Middleware
      -> SetCookie::Middleware
        -> Web Framework
      <- SetCookie::Middleware
    <- Authorization::Middleware
  <- Web server
Response
```
<br />

With this context in mind let's dive right into the code. I've tried to simplify the middleware as much as possible without compromising the context, can you spot the problem?

```ruby
module Authorization
  class Middleware
    BAD_REQUEST_RESPONSE = [
      400, { "Content-Type" => "text/plain" }, ["Bad Request"]
    ]
    
    def initialize(app, policies: nil)
      @app = app
      @policies = policies
    end
    
    def call(env)
      request = ActionDispatch::Request.new(env)
      policy = policies.for_path(request.fullpath)

      # Returns [HTTP_STATUS, HEADERS, [BODY]]
      if policy.satisfied?
        return @app.call(env)
      end

      # Policy not satisfied, redirect to login
      redirect_to_login
    rescue ActionDispatch::Http::Parameters::ParseError => e
      # Log errors and fire some metrics
      BAD_REQUEST_RESPONSE
    end
  end
end
```
<br />

If you managed to pinpoint that the problem is being caused by the `BAD_REQUEST_RESPONSE` constant, congratulations! If not, that's completely fine and we will investigate why that is a problem in the next sections.

## Returning a constant from a Rack middleware

Once our `Middleware` class gets loaded the `BAD_REQUEST_RESPONSE` constant will be defined and stay in memory _until our class goes away_. We can assert that this is the case by doing:

```ruby
require 'objspace'

module Authorization
  class Middleware
    # ...
    def call(env)
      # ...
      puts ObjectSpace.dump(BAD_REQUEST_RESPONSE)
      # ...
    end
  end
end
```
<br />

The output will be similar to:

```json
{"address":"0x120929688", "type":"ARRAY", "class":"0x1208972d8", "length":3, "embedded":true, "references":["0x120929700", "0x1209296b0"], "memsize":40, "flags":{"wb_protected":true, "old":true, "uncollectible":true, "marked":true}}
```
<br />

The important piece of information in our case is the `true` value in the `"uncollectible"` key, which proves that our constant will **not be garbage collected**. We could have also logged `BAD_REQUEST_RESPONSE.object_id` in each request to notice that the object didn't change.

It's important to mention that having an object that is not garbage collected is totally fine unless your object is being modified in a way that makes it increase in size in an unbounded manner. Let's keep digging.

Since `BAD_REQUEST_RESPONSE` cannot be garbage collected we can assume that objects within it are also safe from it. Let's double check this assumption:

```ruby
require 'objspace'

module Authorization
  class Middleware
    # ...
    def call(env)
      # ...
      # Accessing the hash containing our response headers
      puts ObjectSpace.dump(BAD_REQUEST_RESPONSE[1])
      # ...
    end
  end
end
```

The output will be similar to:

```json
{"address":"0x120929700", "type":"HASH", "class":"0x1208951e0", "size":2, "references":["0x1208e3610", "0x120929750", "0x1208e3480", "0x120929728"], "memsize":168, "flags":{"wb_protected":true, "old":true, "uncollectible":true, "marked":true}}
```
<br />

Notice that the `address` can be found within the list of `references` when we ran `ObjectSpace.dump` on the entire `BAD_REQUEST_RESPONSE` object earlier. More importantly, we can again confirm that our inner object won't be garbage collected since it contains `"uncollectible":true`.

## Middlewares can be chained

We've talked about this earlier, but every middleware in our chain can _modify the request or response_ and pass it forward to the next middleware or web framework. What happens if one of our middleware modifies one of the objects _within_ `BAD_REQUEST_RESPONSE`?

Turns out that since our object cannot be garbage collected it will _still be available in future requests_!

We now have a clear picture of what happened:

1. Our `BAD_REQUEST_RESPONSE` constant gets returned to the next middleware when an invalid JSON body is parsed
2. Another middleware in the chain modifies the header object within `BAD_REQUEST_RESPONSE` with a `Set-Cookie`
3. Our framework returns a `BAD REQUEST` HTTP status with a single `Set-Cookie` header
4. A new request with an invalid JSON body arrives
5. Our **modified** `BAD_REQUEST_RESPONSE` constant gets passed to the next middleware when an invalid JSON body is parsed
6. Yet another `Set-Cookie` gets added to the object that contains our headers
7. Our framework returns a `BAD REQUEST` HTTP status with a **two** distinct `Set-Cookie` headers
8. Go back to step 4 and increase the number of `Set-Cookie` headers by one

This means that our `BAD_REQUEST_RESPONSE` object will grow every time a bad request comes in, this is a problem even if it wasn't leaking confidential information.

We can inspect this behaviour in each request by using `ObjectSpace.dump` with the object that contains our headers.

```ruby
ObjectSpace.dump(BAD_REQUEST_RESPONSE[1])
```
<br />

**First request**

```json
{"address":"0x120929700", "type":"HASH", "class":"0x1208951e0", "size":2, "references":["0x1208e3610", "0x120929750", "0x1208e3480", "0x120929728"], "memsize":168, "flags":{"wb_protected":true, "old":true, "uncollectible":true, "marked":true}}
```
<br />

**Second request**

```json
{"address":"0x120929700", "type":"HASH", "class":"0x1208951e0", "size":3, "references":["0x1208e3610", "0x120929750", "0x1208e3480", "0x120929728", "0x120b06578", "0x120a87f98"], "memsize":168, "flags":{"wb_protected":true, "old":true, "uncollectible":true, "marking":true, "marked":true}}
```

Notice how the list of `references` increased between requests. None of these references will be garbage collected either!

## The fix

The fix was pretty anticlimactic and just consisted of _not using a constant_ in our middleware. This guarantees that a new object will be used in each request. 

```ruby
module Authorization
  class Middleware
    # BAD_REQUEST_RESPONSE removed
    
    def initialize(app, policies: nil)
      # Everything remains the same
    end
    
    def call(env)
      # Everything remains the same
    rescue ActionDispatch::Http::Parameters::ParseError => e
      # A brand new Array on each request
      [
        400,
        { "Content-Type" => "text/plain" },
        ["Bad Request"]
      ]
    end
  end
end
```

## Conclusion

Referencing constants within a Rack middleware might cause memory leaks and expose sensitive information. Since the issue is order dependent it might sit undiscovered in the codebase for a long time until a new middleware that is completely unrelated to your old one triggers it. Or it might never become a problem at all!

When in doubt, `object_id` and `ObjectSpace.dump` are great tools to validate assumptions.

Thank you for reading and see you next time!