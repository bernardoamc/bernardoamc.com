---
title: Insecure Software Development
date: "2022-01-28T08:00:00.284Z"
description: "A tale of software development and hidden complexity"
---

## TL;DR;

If you don't have the time or is not sure if you want to read this post, here are the main points discussed:

1. Hidden complexity is a common cause of security vulnerabilities
2. There are multiple ways to tackle complexity in codebases, each with different degrees of success and pitfalls
3. Code review is a great tool to reduce complexity before it becomes a problem
4. Type juggling is still a thing and is a good example of hidden complexity causing issues

## Introduction

Do you remember `Log4J`? What about `Dependency Confusion`? How could you not? At the time of this writing both happened over this past year and disrupted parts of our industry. Development and Infrastructure teams scrambled to patch their systems. Companies with poor asset management had it even worse, trying to identify and uncover vulnerable infrastructure while responding to these incidents. So what does both of these incidents
have in common? I will blame _hidden complexity_ here.

Log4J abstracted environment variables, JNDI, and other kinds of lookups in log messages through a custom syntax that is parsed at the time of logging. Dependency confusion was caused by package managers trying to abstract the domain of dependency management, which is far from simple. In both cases library maintainers made the behaviour implicit.

## Complexity

In practical terms we can define complexity as anything pertaining to our system that makes it difficult to understand or modify.

As software evolves and gains more features, it becomes complex, with subtle coupling between components. This leads to bugs and longer development cycles. Eventually no single developer can keep the entire context of their codebases in their heads anymore and more bugs start popping up, slowing the development cycle even more. There are usually two approaches to fight complexity:

1. Make the code simpler and obvious
2. Encapsulate complexity, abstract

### Make the code simpler and obvious

The idea here is to make things _explicit_. The less our users have to guess in order to use what we built the better. Users here can range from developers to end users of our products, libraries or our own codebases.

1. Good naming practices, meaningful names
   - Can we understand on a high level what this code is trying to achieve without having to dig deeper?
2. Eliminating special cases
   - Can we enforce invariants?
   - Can we just crash instead of handling special cases?
   - Can we have a single implementation for our interfaces?
3. Ensuring consistency
   - Are we following the same patterns across the codebase?
   - Are we enforcing our conventions?
   - Are our comments high level and useful?
   - Do we have good defaults?

From a security point of view fighting complexity by making the code simpler and obvious is a clear winner. Why should we encapsulate parsing environment variables from log messages when this is clearly a special case? Developers can explicitly handle this complexity instead of relying on the library.

### Encapsulate complexity, abstract

The idea of this approach is to _hide complexity_ so developers don't need to understand all the complexities of a certain domain in order to work on it. This is usually related to classes or modules, where each one is designed to be relatively independent of each other. Developers can work in a module without concerning themselves with another.

Notice that this goes against our main point of making things explict. There is a fine balance between choosing what should be explicit and which parts of the domain we can hide without compromising our decision making process while coding. Let's investigate how things can go wrong.

Abstractions can go wrong in two ways:

1. Expose information that is not important (leaky abstraction)
2. Omit details that are important (obscure abstractions or false abstractions)

Leaky abstractions are painful to handle from a developer perspective, but don't affect security as much as false abstractions. Dependency confusion can be explained by false abstractions. By not exposing where dependencies were being resolved from, which is an important detail on this domain, package managers created a false abstraction that allowed attackers to exploit package resolution. Developers didn't have the right information in order to use the abstraction correctly.

## Security

From a security perspective _designing for simplicity_ is the best way to achieve secure code. And simplicity here doesn't only mean less features or code, it means making things more obvious. You can have a functionality that requires hundreds of lines of codes that is simpler than a similar one with half of that code.

Let's use the old Javascript or PHP type juggling as scenarios where code simplicity was not followed:

```js
"0e1234" == 0
true
```

_Javascript snippet_

or

```php
var_dump('0xCAFE' == 51966);
bool(true)
```

_This is fixed in newer versions of PHP_

It's not obvious that type casting will happen during comparison and actually make these comparisons return true. Being forced to remember special cases of your daily functions increases cognitive load and leads to bugs. Unsurprisingly, we had a range of vulnerabilities occurring because of this implicit behaviour.

Plenty of other programming languages and libraries have implicit behaviour, from URL parsers causing _URL confusion_ to user management software not employing the principle of least privilege by default.

So what can we do to reduce hidden complexity in our own systems? This is a really hard question, but code reviews always comes to my mind as a place where software development and security can work together to generate a better outcome.

## Code Reviews

Code reviews are a great way to identify complex or implicit behaviour. It doesn't matter if you are a junior, senior or the ultimate developer, if someone points out that they are having a hard time understanding your code then your code is complex.

As a code reviewer you have the opportunity to:

1. Point out code complexity
   - Are new abstractions encapsulating the right information?
   - Do developers need to have special context to make the right decisions?
   - Do we have a simpler way to handle this?
2. Question the introduced behaviour
   - Are we coding for our _current_ needs or are we trying to _anticipate requirements_?
   - Do we have new dependencies? Are they vetted?
3. Point out special cases
   - Do we have different code paths generating different outcomes?
   - Do we actually need to handle these edge cases?
4. Ask for context through documentation
   - If we have trouble explaining the introduced behaviour things are likely to be more complex than they should

The role you are playing at your company doesn't matter, keeping simplicity and explicit behaviour as goals will benefit the codebase and promote secure code.

## Conclusion

Coding with simplicity in mind not only reduces the amount of functional bugs in your codebase, but also the possibility of security vulnerabilities occurring due to hidden complexity or special case handling.

As developers we should think about our abstractions and reason whether our users have the information they need to make the right decisions. Going even further, do we need to provide every piece of functionality to our users that we are doing today or can our API surface be simplified?

Design for simplicity, and good luck!

Thank you for reading. If you have comments or suggestions I would love to have a conversation about this topic with you. As always you can reach out to me via email or twitter. See you next time!
