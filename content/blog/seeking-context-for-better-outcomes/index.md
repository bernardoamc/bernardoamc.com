---
title: Seeking context for better outcomes
date: "2022-10-30T12:30:00.284Z"
description: "How seeking context can produce better outcomes on decision making."
---

At face value the statement provided in our title seems quite obvious, right? If we know more about something we are bound to make better decisions. Can't we just agree on it and go our separate ways? Unfortunately not. It is common enough to stumble upon decision making events in which people don't have the necessary context that I feel it's warranted to expand on the topic.

Let's start with a hypothetical scenario and we will see how the same question can provide different answers depending on the context. Let's use `Q` for questions and `A` for answers. Let's also define `questioner` as someone who asks a question and `answerer` as the one answering it.

**Q:** "Hello! I'm trying to understand the security risk in allowing fetch requests with credentials: 'include' in a Web Worker."<br/>
**A:** "Since it's up to the server to decide if it should accept cross origin requests with credentials or not, there's no extra security risks associated with it."

There's nothing inherently wrong with this conversation, but the _answerer_ didn't learn anything about the context in which the question was coming from. Let's dig deeper:

**Q:** "Hello! I'm trying to understand the security risk in allowing fetch requests with credentials: 'include' in a Web Worker."<br/>
**A:** "What did you have in mind as a security risk? Could you share a bit more about the context where these fetch requests are coming from?"<br/>
**Q:** "I'm not sure if allowing credentials: 'include' could leak information to a third party. We have third party code running in the Web Worker."<br/>
**A:** "Thanks for the extra context! Are you using `importScripts` to import and run third party code?"<br/>
**Q:** "Exactly!"

This is a much better outcome! We would never have known that third party code was being executed and that's what prompted the `questioner` to reach out in the first place. Now a few things should be considered:

1. Do we have logged in users?
2. What is preventing third party code from triggering `fetch` requests on behalf of such a user?
3. Are cookies `HttpOnly`? If not, these can also be leaked to the third party involved.
4. Is it a Web Worker or can it be a Service Worker?

This example is based on a real conversation where we had to restrict `fetch` requests, make sure cookies were `HttpOnly` and that there were no `SameSite` cookies from different subdomains being exposed. We would never have learned about this use case if we didn't take our time to understand where the question was coming from.

## Seeking context

Questions like these pop up every day and are not exclusive to Application Security. How many times has someone came to you with a question like: 

**Q:** "Hi! I'm trying to do X but it's not working. Can you help me?" 

I'm betting that at least once you just took the question at face value and said:

**A:** "Just do ABC."

And this is completely fine when both of you share the _same_ context. That is, it's fine _most of the time_. How do you know whether `X` is even the right thing to do if you don't know the `questioner`'s goal?

Which brings us to a few things to keep in mind when answering a question:

1. Do you know the underlying context behind the question?
    - This might imply knowledge of the codebase or feature
    - It might also imply historical knowledge of past projects or explorations
2. Do you know what is trying to be achieved?

If the answer for any of those is "no" or "maybe" follow up with probing questions and you might be surprised about the outcome. Here are a few questions that might help you start the conversation in no particular order of importance:

1. Could you explain a bit more about what you are trying to do?
    - Do we have any constraints?
    - What have you tried before?
    - Where did this ask/need come from?
2. Is there anything I can read about the topic?
    - Documentation / RFC / Project Proposal
    - Pull request / code snippet
    - Videos / Blog posts
3. Just to make sure we are on the same page, do you mean X with this?
    - Sometimes agreeing on what the right question is is half of the battle

From my point of view seeking context is usually more important than not because `questioners` assume that the `answerer` has the same context as them. "If I know this, other people should also know it" is the usual thought process and is especially common in questions from more junior team members towards senior teammates.

Note that I'm not claiming that people should be more verbose on a daily basis. Sharing context is about sharing the _key information_ required for someone to make informed decisions. There's no need to recount the entire project history (most of the time) for someone to be able to talk about a particular feature or piece of code.

We can argue that there's no way we can learn the necessary context behind every question thrown our way on a daily basis and that is likely true, but there's an interesting phenomenon that happens when you start asking a follow up question or two before answering. Suddenly the amount of exchanges per question _decreases_ rather than increasing since both _questioner_ and _answerer_ tend to be on the same page. This also gives the _answerer_ the opportunity to forward the question to someone that already has the necessary context, which is equivalent to _triaging_ questions.

So next time you are faced with a question, be curious. I guarantee that when you start seeking context you will frequently learn new things and provide better support in your day to day. It will even increase the amount of trust people have in you. Seek first to understand, then to be understood. See you in our next blog post!
