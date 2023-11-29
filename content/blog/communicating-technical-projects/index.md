---
title: Communicating technical projects
date: "2023-11-28T18:00:00.284Z"
description: "How to communicate technical projects with a broader audience?"
---

As you progress in your career and/or your company grows and becomes more structured, you will find yourself in a position where you need to communicate with a broader audience that might not be entirely familiar with the problem you are trying to solve.. This is a great opportunity to showcase your work and the work of your team, but it can also be a source of anxiety if you are not used to it.

In this post I will share some tips that have helped me in the past and mistakes I've made along the way.

## Why is this challenging?

Let's be honest, we are simply not used to it. When we are early in our careers most of our communication is done with our peers or direct managers, who are also familiar with the problem we are trying to solve and the context around it. Our careers are also overindexed on technical skills, so we tend to focus on communicating the technical aspects of our work. This goes on for a while and we get really good at it, we are able to communicate complex technical problems and solutions in a way that is understandable to our peers.

Things start shifting as we progress in our careers and soon our audience starts changing, expanding might be a better word. Suddenly we are tasked with communicating with an audience that _might not be familiar with the problem we are trying to solve_. It starts gradually, maybe you are asked to present your work in a team meeting, or maybe you are now the face of your team when interacting with an adjacent team across the company. Maybe your are even leading a project? If you got here, you will be the person with the most context in a particular situation more often than not.

So how do we adjust our communication style and get better at it?

## Identify your audience

This is the most important step in my opinion and it's also the one that is most often overlooked. You need to understand who you are communicating with and what is the message you want to convey. This will help you tailor your message to your audience and avoid wasting time on back and forths simply because you are not communicating in a way that is understandable to them.

This used to happen fairly frequently in conversations between me and my wife. I would be talking about a technical problem I was trying to solve and she simply didn't have the required context to understand what I was talking about, forcing her to ask clarifying questions that I would struggle to answer without the usual technical jargon. It also happened the other way around, she would be talking about marketing concepts and acronyms that I was not familiar with and we would end up in the same situation. "We are optimizing CAC across diverse acquisition channels and fine-tuning from TOFU to BOFU.", simple stuff right? Sure.

Of course over time we learned things from each other's fields and this became less of an issue, but it was a great opportunity to learn how to communicate with a different audience. You will likely not spend as much time with your audience as you do with your partner or friends, so you need to be more deliberate about it.

In summary, the first question to ask yourself is:

1. "Who is my audience?"

Are they technical? What are they familiar with? What is their area of expertise? What is their interest in the topic? As you can see asking yourself that first question will lead you to other questions that might help you identify your audience and tailor your message. Let's see how we can do that.

## Tailor your message

As a general rule of thumb, it is often more important to communicate the _what_ and the _why_ than the _how_. You should focus on the problem you are trying to solve and how your solution solves it. If your audience is interested in the _how_ they will ask you about it and in this case you can go deeper into the technical details of your solution. Avoid jargon and acronyms that are not common knowledge. If you need to use them, make sure to explain what they mean.

Let's look at an example:

**Situation 1**

You are trying to solve a bottleneck in your Kafka consumers after noticing that your application is not processing messages fast enough. This is causing your order processing to be delayed and your customers are not receiving their order confirmation emails in a timely manner. Your solution included scaling your Kafka consumers horizontally, optimizing some database queries and also removing synchronous calls to your email service by using background jobs.

**How do we communicate the problem?**

Unless your audience is also hands-on in your application, the terms Kafka, consumers, background jobs and database queries are not going to be very helpful. Instead, you can focus on the problem you are trying to solve. Something like: "We noticed that our customers are not receiving their order confirmation emails in a timely manner, this is causing a lot of confusion and frustration. We are working on a solution to fix this."

**How do we communicate the solution?**

Again, unless your audience is also hands-on in your application, the terms Kafka, consumers, background jobs and database queries are not going to be very helpful. Instead, you can focus on the solution you are implementing. Something like: "We are scaling our email processing to handle more emails per second, this will allow us to send order confirmation emails faster and avoid delays. After our changes we noticed that our email delay went from 10 minutes to 1 minute on average."

I can guarantee that your audience will be extremely happy to hear about that update, and if they are interested in the technical details they will ask you about it.

But things are not always that simple, let's look at another example:

**Situation 2**

You have a project in your hands to solve the problem of tracking the number of security issues across your organization. Leadership already acknowledged that this is a problem and they are looking for a solution. You are tasked with coming up with a solution and are now presenting the current state of the project to the broader organization over the past week or so.

**How do we communicate the problem?**

Your probably don't. They already know the problem at hand, especially if it is documented somewhere. You can remind them if you feel this will help, but you should focus on the solution you are proposing.

**How do we communicate the solution?**

This is where things get interesting. You are mid way through your project and you are heads-down on the technical details of your solution. You are probably thinking about the database schema, how to create dashboards, etc. But your audience is not interested in that, they want to know how this will help them. Again, you should focus on the _what_ and the _why_ of your solution.

So let's say you managed to implement half of our intended solution so far and it involves surfacing data in a dashboard somewhere and also modeling the data in a database. Why is the dashboard important? Because it will allow us to track the number of security issues across the organization and also identify trends. Why is the database important? Because it will allow us to store the data in a way that is easy to query and also respond to questions that our stakeholders likely care about like "How many security issues did we have last month?" or "How many security issues are past their SLA?".

This brings us to the other two questions to ask yourself:

1. "What does my audience care about?"
2. "What is the best way to convey this message?"

## Ask for feedback

This is a great way to improve your communication skills. Your peers and managers will be glad to help you improve your communication skills since they are the ones directly benefiting from it. Ask for _actionable_ feedback, you want to receive something like "I noticed that you used a lot of acronyms in your presentation, I think it would be helpful to explain what they mean." since it is much more helpful than "I didn't understand what you were talking about.".

## Use visuals

Using visuals is a great way to convey your message. It can be a diagram, a graph, a screenshot or even a video. Besides being more engaging, it also prevents your from being overly technical since you will be condensing your message into a visual representation. It also helps you identify gaps in your message.

## Empathize with your audience

Empathize with your audience. Put yourself in their shoes and think about what they would like to hear. I'm sure there were moments where you were part of the audience and wished for a different delivery.

## Be concise

Is your audience time constrained? If so, you should focus on the most important things and avoid going into too much detail. Always assume that this is the case, unless you have a reason to believe otherwise. You can always share more details later if they are interested.

## Conclusion

Getting better at communicating technical projects is a great way to showcase your work and the work of your team. It is also a great way to build trust with your peers and managers. It is a skill that is often overlooked and it is not something that we are used to doing, but it is a great way to learn and grow. Here are the three questions to ask yourself:

1. "Who is my audience?"
2. "What does my audience care about?"
3. "What is the best way to convey this message?"

I hope this was helpful, if you have any feedback or questions please reach out to me! See you next time.
