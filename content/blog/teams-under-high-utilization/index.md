---
title: Watch out for teams under high utilization
date: "2022-04-22T12:30:00.284Z"
description: "A deep dive on how teams under high utilization are negatively impacted and how to spot this pattern in your own teams"
---

In this blog post we will discuss team responsibilities through the lenses of [queueing theory](https://en.wikipedia.org/wiki/Queueing_theory). If you are not familiar with the concept don't worry about it, but you will have to trust some of my claims. The main one being the relationship between lead time and throughput and how a _system running close to capacity tends to have higher lead times_. Put another way:

> As utilization goes up, lead time goes up as well. Except that lead time goes up exponentially.

But if I'm doing more, how can I be moving slower? This seems counterintuitive at first and it's the reason I'm writing this blog post.

Let's define what we mean with "High utilization" and what "lead time" actually is. Once we have these definitions in place we can try to tie those concepts together and see how they impact our teams.

## High utilization

We can define high utilization as team members spending _most of their time_ tackling tasks directly related to the delivery of their projects. You can think of these tasks as something that _moves the project forward towards completion_. In most cases this will mean feature development, but it also applies to operational teams taking care of areas like infrastructure or security. Put another way, team members have most of their time occupied with individual tasks, not with shared responsibilities like documentation, code reviews or mentoring.

Everyone has a queue of tasks that needs to be done "now", and this queue only grows as the number of tasks increases. I'm sure most of you have been in this position before, where it doesn't matter the amount of work you do, there's always new things in the queue. This seems great from a company or management perspective since it implies things are getting done. Or is it? I will argue that it's the opposite. The higher the utilization the longer teams will take to complete their tasks and deliver value.

Again, I know this seems counterintuitive.

## Lead time

We will use the common definition of lead time, which is:

> Lead time measures the time from the moment someone makes a request to the time they receive something

If you have more tasks than you can handle it's a given that something will have to wait in the queue, but why would lead time increase exponentially?

## Common reasons

While each team will face distinct challenges, there are commonalities among teams under high utilization. Some or most of those are directly related to an increase in the cognitive load of each team member.

**Prioritization**

It's easy to prioritize among a small number of tasks, but it becomes increasingly harder to prioritize a higher number of them. Should you unblock a team that has been waiting for a few weeks, run a security review for an important product release or validate the approach that a team is planning to take on their technical design? Wait, what about this new incident that just started?

It is time consuming to reason about what should be done next and it's likely that the team will have to prioritize for the short-term. This is not beneficial from a business perspective and tends to make things worse in the long run.

**Psychological stress**

Even if you do end up prioritizing efficiently, just the sheer fact of having a queue with lots of high-priority tasks in it is stressful, reduces the ability to concentrate, and increases the cognitive load. Being on-call is a good example here, even if there's a possibility that nothing will happen there's always that underlying "stress" that makes people unable to fully relax or focus.

**Context switching**

It's no surprise that people are more productive when they can work on a task from start to finish without interruption, but as the utilization goes up, so does the amount of concurrent tasks people are tackling. Unfortunately switching context is _expensive_, energy and time-wise. This will not only decrease the throughput of the team, but also decrease the overall quality of the final product.

**Coordination**

Even in the best circumstances coordination is a challenge, but when every team member is being fully utilized coordination becomes exponentially harder. This becomes evident when a task falls under the umbrella of _shared responsibilities_, like code reviews or documentation. Why?

Depending on your team, one or two people will need to set time aside to review a particular pull request, but who has time to do it? While no one sets time aside (or is not directly told to help), at least one person in the team is blocked or will have to switch contexts while they wait. Since we are aiming for high utilization we likely have someone else waiting on this task to be done, that person will also need to switch contexts.

The second type of coordination is logistical, it assumes we are able to plan our tasks and predict how long each one will take correctly. It also assumes no one else in the team will face unforeseen circumstances. Sounds far from reality, does it not?

## Usual consequences

While every team will face distinct challenges, most of them will face the same consequences.

**Communication**

One of the first things that breaks down is communication. Asynchronous messages start taking longer to be answered or not answered at all in public and private channels. Emails or issues will tend to be forgotten until someone volunteers or gets "voluntold". You will notice less engagement in meetings, with people multitasking or not participating at all. This in turn decreases the amount of collaboration and trust among team members.

**Shared responsibilities**

With every team member under high utilization shared responsibilities starts falling through the cracks. These are the responsibilities that are not tied to any single individual, but that are shared among the team. Among those we can list:

* Mentorship
* Knowledge sharing
* Code reviews
* Documentation

Among those, code reviews and mentorship directly impacts the cycle time as well. Notice how all of those are critical for a healthy organization in the long-term. It's not a coincidence that they are deprioritized.

## Why does this myth of high utilization persist?

If doing things this way impacts delivery speed and quality in the long run, why do we still see high utilization as a positive signal? My theory is that most of our industry is caught up playing short term games. 

Leadership is expected to provide results in short-term cycles, hence management gets recognized for delivering projects in tight timelines and developers are rewarded when they are able to ship tasks as fast as possible. None of these behaviours are responsible for creating better products, teams or culture in the long run. This reminds me of a quote from Dave Packard:

> “More Organisations Die Of Indigestion Than Starvation”

This quote really resonates with me. We need teams focused on a small number of objectives that are aligned with the company vision. High utilization doesn't allow for strategic planning, getting teams caught up in a tactical mindset.

## Things to look out for

If you are not sure whether your team is under high utilization or not (you probably know) you can look for the following characteristics:

* Team members working alone or in small teams due to too many initiatives
* Poor engagement in meetings
* Asynchronous channels (Slack, email, etc) drying up in participation or being slow/ignored
* Pull request cycle time increasing
    - PRs are taking longer to be opened (high complexity/lower quality in the codebase)
    - PRs are taking longer to be reviewed (context switching) 
* Increased amount of bugs in production
* Knowledge silos (small groups each holding part of the knowledge while no one in the team holds the full picture)
* Lack of documentation

Pay special attention to decisions on how the strategic objectives should be delivered being made without or far from the team that is executing it.

## Caveats

There are moments where high utilization is unavoidable. For example, if your company is trying to find market fit or when time to market is critical for success. These tend to be highly overestimated by companies, but it is a legitimate scenario that should be taken into consideration. With that said, keeping teams under high utilization for long periods of time is not a viable strategy.

## Conclusion

It takes a team to push against the myth of high utilization. Developers should raise their concerns when they feel they are lacking support or stretched too thin. Knowing when to say "no" is a powerful skill to have. Managers should listen to the team's feedback, but also keep an eye on and push back when they feel like the team is juggling between too many responsibilities. You will rarely hear a "no" from junior developers and it is your job to pay attention to a high utilization situation. Leadership on the other hand should trust that their teams are making good decisions on how their strategic objectives should be delivered. Make sure, despite the level you are operating in, that you have alignment with people around you and avoid making assumptions about what people know.

Ultimately growing queues (faster than cycle time) are inevitable, but there’s a big difference between accepting this fact and still allowing the team to do deep work versus trying to tackle everything at the same time. When everything is a priority, nothing is a priority.

Thank you for reading. If you have comments or suggestions I would love to have a conversation about this topic with you. As always you can reach out to me via email or twitter. See you next time!