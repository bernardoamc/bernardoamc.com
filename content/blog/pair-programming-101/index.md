---
title: Pair Programming 101
date: "2021-09-25T10:11:00.284Z"
description: "How to implement productive pair programming sessions?"
---

Pair Programming is easily one of my favourite activities on my day to day job, but getting them right is not always easy. The idea that it's enough to set up those sessions and everything will flow permeates our industry, but things rarely go smoothly without prior planning. This post is an effort to explain the way I usually approach pair programming and I hope you will find one or two things that can help you in your future sessions.

Before we start it's worth mentioning that as people get to know and trust each other it becomes easier to have impromptu pair programming sessions.

## What is the goal of a pair programming session?

Let's investigate which goals are best suited for this workflow. This list is non-exhaustive, but those three points have been my main reasons to pair program for some years now.

#### Sharing knowledge

Pair programming is a great tool to onboard new peers into a codebase, project or even a single task. The idea of being able to ask questions while diving into critical parts of the code from someone with higher context makes this goal a particularly good fit for pair programming.

It's also an interesting tool to pick up tips and tricks from other developers on your team. From how to better navigate code to IDE shortcuts and different workflows.

#### Brainstorming

It's very common for developers to get stuck trying to come up with an implementation that they consider solid. Pair programming gives them the opportunity to brainstorm with different developers and gather insights that might unlock a great solution to the problem at hand.

#### Time constrained tasks 

Bugs, security issues, on-call alerts, the list goes on and on. The common characteristic of these items is that they need to be tackled _fast_. Pair programming as a way to validate those quick fixes works really well to prevent developers from rushing with a non ideal solution. It also helps calm people down as they don't feel alone in their moment of crisis.

## What pair programming is not?

It's not a way to speed up development. Once both parties agreed upon a particular solution it's usually easier for someone to own the task and finish it up. Reviewing the pull request will become much easier since at least one of the reviewers will already have plenty of context on the subject. Pair programming shortens the feedback loop in this case.

## Requirements for a productive session

Below I will list the critical requirements for a productive session. They might work slightly different depending on the goal of the session, but most of the time they will prove useful.

#### Create an agenda

Calling someone to a pair programming session without sharing context is a recipe for unproductive sessions. One of two things might happen:

1. You will need to spend time out of the session sharing context before you can even begin making use of it.
2. You will likely end up with a subpar solution.

The second point is especially true when one of the parties is considered more senior than the other. What happens is that the senior "solution" will likely be followed without both parties bouncing ideas off each other.

**Example of an agenda**

Hey, I have this task and I would love to pair program, here are the requirements:

1. Read a CSV with repositories
2. Mass update database tables/rows based on the CSV criteria

This is the issue we are trying to tackle: _issue link_
You can also read more about it: _here_

Let me know when we can meet to pair program.

#### Evaluate solutions

With the agenda in place hopefully both parties have the required context to discuss the task at hand. This new step takes part in the beginning of a session and its goal is to share potential implementation ideas and discuss until these ideas converge into a solution that make both parties satisfied.

It's also a great moment to ask questions like "How did you come up with this implementation?" or "Why did you pick X over Y?". Mentoring becomes much easier once you have a bounded task that both parties fully understand and had time to think about.

#### Establish ground rules

It's draft implementation time! But before we dive right in let's establish some ground rules to make our session more productive for both of us.

1. Who is driving?
   * Should we switch? When?
2. If I notice a typo, should I speak up right away?
   * Should I wait till we finish the line/method/class?
3. Should we be concerned with variables/methods/classes naming right away?
4. How long should our sessions last?
   * Everyone has a different limit to how long they can focus without feeling drained.

It seems simple, but answering these questions can make your sessions less stressful or tiring.

## Departing thoughts

Ultimately pair programming shouldn't be stressful. Whether you are a junior or senior developer you shouldn't have the feeling that you are being judged. Having a conversation about ground rules will pay off in the long run if you currently have this feeling in your sessions.

Again, this is not an exhaustive list, if you have other steps/criteria that works for you I would love to chat! Reach out to me via email or Twitter and we can figure out something. See you next time!
