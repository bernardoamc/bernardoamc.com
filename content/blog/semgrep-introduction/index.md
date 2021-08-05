---
title: A Practical Introduction to Semgrep
date: "2021-07-31T21:00:00.284Z"
description: "Let's explore this modern static analysis tool and how it allows us to identify patterns in our code for linting or security purposes."
---

Lately I've been working on automating security rules and enforcing best practices in our codebases using static analysis tools. Besides [Brakeman](https://brakemanscanner.org/) and [CodeQL](https://securitylab.github.com/tools/codeql/) I have also been using [Semgrep](https://github.com/returntocorp/semgrep), which is the topic of this post.

[Semgrep](https://github.com/returntocorp/semgrep) is a open-source static analysis tool that allows us to find patterns in our code. In this post we will explore how its rule system works through a practical example and some tips on how to get started writing your own rules.

Before we start, it's worth mentioning that Semgrep has a great [online editor](https://semgrep.dev/editor/) that allows us to visually test how rules match our code. It is a great tool to rapidly iterate on and share your work with others. Another resource that helped me get started is their [interactive learn section](https://semgrep.dev/learn). It relies heavily on the editor and does a great job ramping us up on how its rule system works.

With that out of the way let's explore an example in `Ruby`, which is [one of the languages](https://semgrep.dev/docs/language-support/) supported by Semgrep.

## Example

The code we are going to work on is the following:

```rb
provider :acme,
    api_key,
    per_user: true
```

Our goal is to flag code that falls into one of the following criteria:

1. The provider is `:acme` and `per_user` is `false`
2. The provider is `:acme` and `per_user` is missing

With this criteria in mind let's create our new rule. Rules in Semgrep are expressed through `YAML` and it helps to know the standard beforehand. That being said the standard is readable enough that you should be able to follow this tutorial without being familiar with it.

Let's encode the first part of our criteria:

```yaml
rules:
- id: alert_per_user
  pattern: 'provider(:acme, ..., per_user: false, ...)'
  message: per_user is false or is missing for acme provider
  languages: [ruby]
  severity: WARNING
```

There are a few things we can infer right away from this rule and certain things that won't make sense until we start diving into the details of Semgrep, so let's start with the basic ones.

Every rule has an unique `id` and a descriptive `message` associated with it and also knows the semantics of one or more `languages` that it is trying to analyze, which in our case is `Ruby`. The semantics part is really powerful - to understand why let's see how we could have coded our example above:

```rb
# No parenthesis and new hash format
provider :acme,
    api_key,
    per_user: true

# No parenthesis and old hash format
provider :acme,
    api_key,
    :per_user => true

# Parenthesis and new hash format
provider(:acme,
    api_key,
    per_user: true
)

# Parenthesis and old hash format
provider(:acme,
    api_key,
    :per_user => true
)
```

These examples are all the same from a `Ruby` standpoint but writing a regular expression to match it would be very cumbersome. On the other hand since Semgrep understands the semantics of the language we can succintly match **all of these cases** with a single and expressive pattern.

## Pattern breakdown

Rules are expressed by `patterns`, and currently our only pattern is:

```yaml
pattern: 'provider(:acme, ..., per_user: false, ...)'
```

Semgrep knows that `provider` is a `method` and that's why it can match any code with our without parenthesis. It also knows that `:acme` is a hardcoded symbol. If we were searching for any symbol we could have used a [metavariable](https://semgrep.dev/docs/writing-rules/rule-syntax/#metavariable-matching) like `$NAME`.

More importantly, it knows that `per_user` is part of a `Hash` so it can also match different Hash syntaxes.

What are these ellipses (`...`) though? 

These are used to tell Semgrep that we don't care _which position_ our `per_user` is in, we just care that it exists. These ellipses match anything that comes _before_ and _after_ our `per_user` declaration.

## Adding our second requirement

Now that we have met our first requirement, how can we fulfill the second one?

> The provider is `:acme` and `per_user` is missing

What we want is:

> Match `pattern A` OR `pattern B`

The way we express the `OR` operator is by using what Semgrep calls `pattern-either`, which is pretty descriptive. Let's add our second requirement to our `YAML` file:

```yaml
- id: alert_per_user
  pattern-either: 
    - pattern: 'provider(:acme, ..., per_user: false, ...)'
    - patterns:
      - pattern: 'provider(:acme, ...)'
      - pattern-not: 'provider(:acme, ..., per_user: $X, ...)'
  languages: [ruby]
  severity: WARNING
```

What we are saying with this rule is:

Find me a `provider` method call that includes `:acme` <br />
**AND** <br />
has a key `per_user` with value `false` <br />
**OR** <br />
a `provider` method call that includes `:acme` <br />
**AND** <br />
doesn't have the `per_user` key inside it.

Note the use of the ellipses (`...`) in this case, it means that we don't care about what's inside the `provider` method call after the `:acme` symbol is found, so Semgrep will match anything till the end of the method.

And with this succint rule we were able to match our entire criteria without having to worry about method call conventions, line breaks or spaces or even Hash formats. How cool is that?

## Going one step further

Let's pretend that our method call occurs in two different contexts, but that we are interested in only matching one of them.

```rb
# We want to match in this context
middleware.use(OmniAuth::Builder) do
  # Our pattern
end


# We don't care about this context
middleware.use(Dummy::Builder) do
  # Our pattern
end
```

In order to solve this we can rely on a new operator called `pattern-inside` that will act as a filter for our patterns. By using it we are saying asking Semgrep to only consider patterns that reside within our `pattern-inside` expression.

Let's see how we would encode this in our rule:

```yaml
- id: alert_per_user
  patterns:
    - pattern-inside: |
        middleware.use(OmniAuth::Builder) do
            ...
        end
    - pattern-either:
        - pattern: 'provider(:acme, ..., per_user: false, ...)'
        - patterns:
          - pattern: 'provider(:acme, ...)'
          - pattern-not: 'provider(:acme, ..., per_user: $X, ...)'
```

We are again making use of our ellipses within `pattern-inside` to say that Semgrep should match anything inside the middleware block. The pipe (`|`) symbol at the end of our `pattern-inside` line signifies that any indented text that follows should be interpreted as a multi-line value according to the `YAML` spec.

And with this new addition our rule is now context aware which is great in scenarios where code is environment dependent. We can now consider our exercise complete!

## Conclusion

Semgrep is powerful and simple enough to make it a good choice when automating CI rules. There are situations where I still fallback to Brakeman though and that usually happens when I'm required to write custom code to enforce a check since I can rely on the full power of `Ruby`. For example, writing a custom check that detects spelling mistakes in arguments within a method call like `Rails.cache.fetch`, such as detecting an incorrect use of `expire_in` or `expirs_in` instead of the expected `expires_in` is currently much easier using Brakeman.

In this post we have just scratched the surface of Semgrep, refer to the [rule syntax guide](https://semgrep.dev/docs/writing-rules/rule-syntax/) for the full schema. Operators like `pattern-inside` and `metavariables` make the schema extremely flexible.

Let me know if you have any tips or questions by reaching out to me on Twitter or by email and I will be happy to chat about it!

## Update 2021-08-05

[@clintgibler](https://twitter.com/clintgibler) was kind enough to provide an example on how they would approach the problem mentioned in the conclusion of this post using Semgrep. I will share the example here, but there are more details in the [thread](https://twitter.com/clintgibler/status/1423046781600813057) that you can follow.

**When we know each argument the method expects:**

<iframe title="Rails Cache Invalid Args" src="https://semgrep.dev/embed/editor?snippet=clintgibler:rails-cache-invalid-args" width="100%" height="430px" frameborder="0"></iframe>
<br/><br/>

**When we do not know every method argument:**

We could approach this problem doing a string edit distance comparison or something similar with Python using the [#patern-where-python](https://semgrep.dev/docs/writing-rules/rule-syntax/#pattern-where-python) operator.
