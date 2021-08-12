---
title: Ensuring postMessage Origin Validation with Semgrep
date: "2021-08-11T08:30:00.284Z"
description: "Let's explore how we can validate postMessage declarations in our JavaScript or TypeScript codebases."
---

If you are new to [Semgrep](https://github.com/returntocorp/semgrep) I recommend checking out my [previous post](/semgrep-introduction) where we cover the basics and create a new rule step by step.

In this post we will tackle the challenge of flagging scenarios in our codebase where developers forgot to check the origin of a message consumed through [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). This rule will be used to mitigate one of the [security concerns](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns) mentioned within the MDN documentation, the `origin` validation.

> Any window (including, for example, http://evil.example.com) can send a message to any other window, and you have no guarantees that an unknown sender will not send malicious messages.

[Here's an example](https://labs.detectify.com/2017/02/28/hacking-slack-using-postmessage-and-websocket-reconnect-to-steal-your-precious-token/) of this vulnerability being exploited.

I've also submitted a [Pull Request](https://github.com/returntocorp/semgrep-rules/pull/1415) to the [semgrep-rules](https://github.com/returntocorp/semgrep-rules) repository and by the end of this post we will understand every aspect of it. :)

With the context in place, let's start!

## Patterns to flag

Before we start writing our new rule it helps to document the patterns we want to match. Besides having a clear spec to work with it also makes it easier to reason about which operators we will need.

```js
// Inline function without origin check
window.addEventListener("message", function(evt){
  console.log('No origin check!');
});

// The following line creates a function that will
// be used as a handler by our addEventListener. This
// handler should also have an origin check.
function receiveMessage(evt) {
  console.log('No origin check!');
}

window.addEventListener("message", receiveMessage, false);

// Inline arrow function without origin check
window.addEventListener('message', (evt) => {
  console.log('No origin check!');
});

// The following line creates a function using the
// arrow function pattern which will be used as a
// handler by our addEventListener. This
// handler should also have an origin check.
const arrowHandler = (evt) => {
    console.log('No origin check!');
};

window.addEventListener("message", arrowHandler, false);
```

Knowing that we need to match `inline` or `external` declarations gives us an idea that we will need to rely on the [patterns-either](https://semgrep.dev/docs/writing-rules/rule-syntax/#pattern-either) operator. 

We might be tempted to write four different patterns for this scenario, but since Semgrep is semantic we only need to write **two**! This means that patterns matching and old `function` declaration will also match code using `arrow functions`. 

It's worth repeating this:

> Since Semgrep is semantic, patterns matching and old `function` declaration will also match code using `arrow functions`

 Now, which patterns do we consider safe for origin checking?

## Safe patterns

If the function specified above contains any of the following patterns we **should not** flag them:

```js
if (evt.origin == "http://example.com") { ... }

if (evt.origin === "http://example.com") { ... }

if (evt.origin != "http://example.com") { ... }

if (evt.origin !== "http://example.com") { ... }

if (someRegex.test(evt.origin)) { ... }
```
<br />
We have our spec, we know what to flag and more importantly, what not to. Time to start working on our rule!

## Writing our rule

Let's take care of the `inline` functions first since they don't need external context:

#### Inline functions

```yaml
patterns:
- pattern: |
  window.addEventListener('message', $FUNC, ...)
```

`$FUNC` will capture the inline function into a [metavariable](https://semgrep.dev/docs/writing-rules/pattern-syntax/#metavariables). Now we can use the handy [metavariable-pattern](https://semgrep.dev/docs/writing-rules/rule-syntax/#metavariable-pattern) to exclude our **safe patterns**.

```yaml
patterns:
- pattern: |
    window.addEventListener('message', $FUNC, ...)
- metavariable-pattern:
    metavariable: $FUNC
    patterns:
      - pattern: |
          function($OBJ) { ... }
      - pattern-not: |
          function($OBJ){ ... if ($OBJ.origin == $X) ... }
      - pattern-not: |
          function($OBJ){ ... if ($OBJ.origin === $X) ... }
      - pattern-not: |
          function($OBJ){ ... if ($OBJ.origin != $X) ... }
      - pattern-not: |
          function($OBJ){ ... if ($OBJ.origin !== $X) ... }
      - pattern-not: |
          function($OBJ){ ... if ($REGEX.test($OBJ.origin)) ... }
```

We want to match function declarations (`pattern`) that **do not** contain any of our safe patterns (`pattern-not`). Note the ellipsis surrounding our `if` statements, they are there to guarantee that we are matching any line within the function, not just the first line.

A few other things are worth noting here:

1. Our metavariable is matching on the context captured by `$FUNC`
2. We need the the `function($OBJ) { ... }` check to exclude external function declarations (our second scenario)
3. The `$OBJ` metavariable is matching the function parameter and making sure the `.origin` is being called on it

I like how explicit the rule currently is, but we will see an alternative to simplify our `pattern-not` by the end of this post. Bear with me for now if this is bothering you. :)

Time to match the external functions!

#### External functions

```yaml
pattern-either:
  - pattern: |
      function $FNAME(...) { $CTX }
      ...
      window.addEventListener('message', $FNAME,...)
  - pattern: |
      $FNAME = (...) => { $CTX }
      ...
      window.addEventListener('message', $FNAME,...)
```

_This is the only situation where I couldn't use the same pattern to match `arrow functions` and normal `function` declarations. Let me know if I could simplify this pattern._

Here we are making sure that we can match any of the function declaration types with `pattern-either` and capturing the function names during declaration with `$FNAME`. Note that we use the same `$FNAME` metavariable to ensure that the **same name** is being used within `addEventListener`. The ellipsis (`...`) are there to match anything in-between those two lines.

We are also capturing the context of the function body itself with `$CTX` and we will use it to exclude our **safe patterns**. Let's get to it:

```yaml
pattern-either:
  - pattern: |
      function $FNAME(...) { $CTX }
      ...
      window.addEventListener('message', $FNAME,...)
  - pattern: |
      $FNAME = (...) => { $CTX }
      ...
      window.addEventListener('message', $FNAME,...)
  - metavariable-pattern:
    metavariable: $CTX
    patterns:
      - pattern-not: |
          ... if ($OBJ.origin == $X) ...
      - pattern-not: |
          ... if ($OBJ.origin === $X) ...
      - pattern-not: |
          ... if ($OBJ.origin != $X) ...
      - pattern-not: |
          ... if ($OBJ.origin !== $X) ...
      - pattern-not: |
          ... if ($REGEX.test($OBJ.origin)) ...
```
<br />

Nothing new here, we are ensuring that we ignore matches if they contain any of the `if` patterns declared by our `pattern-not` operators. These patterns are being checked on the context of `$CTX` which is our function body. We are also making sure to match these patterns in any line by surrounding our patterns with ellipsis.

With those two cases being taken care of separately we can move to our final rule declaration.

## Final pattern

In order to make this work we need to glue both scenario using `pattern-either`. Let's check our final rule in the playground:

<iframe title="postMessage Origin Validation" src="https://semgrep.dev/embed/editor?snippet=bernardoamc:postmessage_origin_validation" width="100%" height="430px" frameborder="0"></iframe>
<br/><br/>

And with this new rule we can match:

1. Inline function declarations in any format
2. External function declarations in any format
3. Create a list with patterns we consider to be safe for origin checking

This rule achieves exactly what we set ourselves to do and we could just stop here, but as I've hinted earlier we can simplify things. Let's investigate! 

## Alternative

Instead of explicitly checking for each equality operator in our `pattern-not` we could have used the [deep-expression-operator](https://semgrep.dev/docs/writing-rules/pattern-syntax/#deep-expression-operator) which basically lets you say: <br /> _"I don't know what exactly happens in here, but I want to enforce that this variable is used somehow"_.

Let's rewrite our rule above using this operator and see how it simplifies our `metavariable-pattern` declaration:

<iframe title="postMessage Origin Validation Alt" src="https://semgrep.dev/embed/editor?snippet=bernardoamc:post_message_origin_check_deep_exp" width="100%" height="430px" frameborder="0"></iframe>
<br/><br/>

Pretty cool, right?!

The downside of this approach is that any reference to `$OBJ.origin` in a `if statement` will match, even if it doesn't perform the sort of validation that makes it safe. In this particular case I wanted to be strict and enforce the presence of certain equality operators, but that changes on a case-by-case basis.

As a rule of thumb if you just want to check that something is being called/referenced use the `deep-expression-operator`, otherwise stick with explicit pattern matching. 

<br />

And with this we have reached the end of this blog post. Thanks for reading and let me know if you have any tips or questions by reaching out to me on Twitter or by email and I will be happy to chat about it!
