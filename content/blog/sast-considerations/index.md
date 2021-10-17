---
title: Introducing static application security testing (SAST) to an organization
date: "2021-10-19T18:15:00.284Z"
description: "Is implementing SAST in your organization as simple as it looks?"
---

Static Application Security Testing (SAST) is a technique that relies on source code analysis to search for known vulnerable or dangerous patterns. It is particularly useful as a source of early feedback to developers when integrated to a company's CI pipeline in order to identify issues before they make it to production.

Disclaimer, this blog post expands on [this excellent thread](https://twitter.com/alsmola/status/1411429895222140929) by [Alex Smolen](https://twitter.com/alsmola) and will focus on what a team should consider when introducing SAST at scale. It is not an attempt to describe the pros and cons of the technique or detail the domain where it is the most effective.

## Background

Experimenting and introducing SAST tools is becoming a prevalent technique in our industry with promises that it will make our codebases more secure without too much effort, but that's far from the truth. There are many aspects to be considered when introducing these tools to your organization if you don't want to actually make it worse.

1. Developer experience
    * How fast is the CI step
    * How false positives are reported or skipped
    * Are rules actionable and teaching developers how to fix the issue
2. Data analytics
    * Which types of vulnerabilities were uncovered
    * How many vulnerabilities were uncovered
    * How many duplicates are being generated
    * How many false positives or false negatives are being generated
    * What are the SLOs after a vulnerability is uncovered
3. Process
    * When and how should a repository be onboarded
    * When should a rule be added or removed
    * How rules across tools are deduplicated
    * How tools are introduced or dropped
    * How to report alerts to developers
    * How to report results to leadership

I'm sure there are things that I forgot to mention, but the list above should give you an idea that introducing SAST to your organization is just the first step and doesn't mean much unless you have also figured out some or all of these questions. Let's expand on each of these categories.

## Developer experience

A SAST process that prevents developers from shipping code is actually harming the business rather than helping it, so the first thing to consider when introducing it is to analyze how it will impact the developer experience. Is the new CI step impacting delivery? Are false positives forcing developers to reach out to the security team all the time before shipping? The goal is to create a process that helps developers, not one that gets in their way.

The security team plays a huge part in validating dismissed alerts and figuring out whether they were false positives or not. If they were, how should the team prevent them from being triggered in the future? Giving the ability for alerts to be dismissed/reported as false positives is a key part of the process, otherwise the security team will likely be overwhelmed with reach outs from the entire organization.

With all of the above said, this process is still bound to annoy a few developers in your organization. Having the buy-in from leadership and creating a culture around not compromising quality, performance and security will do wonders for the acceptance of this process. Finding developers across the organization that are interested in security can also help to raise awareness and build knowledge across the organization.

Last but not least, alerts should be surfaced in a way that guides developers towards learning why that particular pattern is considered dangerous or a vulnerability and how to prevent it in the future.

## Data Analytics

Is the team able to prove to leadership that the process is successful? Is it the best use of their time? Planning how to collect **actionable data** from the start will play a huge role in making the entire effort successful.

### Rules & Alerts insights

Which rules or alerts are the most impactful? Having data will allow the team to uncover which rules are being useful to the business and which ones should be removed due to the amount of false positives or unreasonable CI time. Identifying missing rules is the next step and partnering up with the internal Bug Bounty program if one exists might be the way to close the feedback loop.

The team should have metrics and set expectations for  categories of alerts and closely monitor whether these expectations are being fulfilled. Let's see some examples:

1. Services running our SAST tools should see a 30% decrease of bug bounty reports
2. Services running our SAST tools should see a 20% increase in fixable security issues
3. Services running our SAST tools should have at maximum 25% of alerts dismissed

These metrics and expectations will dictate areas of improvement for your process.

### Tool insights

Which tools are being useful and does the current pipeline have any gaps? How long does each tool take in the CI/CD pipeline? Is the return of investment (time invested versus findings) worth the introduction and maintenance of tool?

Having a clear picture of the current code coverage per language or framework in a tool is an important step to guide the future roadmap.

### Management insights

How long does it take for an issue to be actioned? Setting SLOs for findings and being able to track whether they are being actioned on time is an important part of the process. Being able to track when an issue was opened or closed and having SLOs for different kinds of severities is a great way to keep the organization accountable.

## Process

Each part of the process should be documented; this will help with its maintainability and allow it to scale up when the time comes. An interesting side effect of having the entire process documented and backed up by data is that it becomes apparent when a particular step is underperforming or becoming a bottleneck. These areas are prime targets for early automation.

Having a clear set of metrics to report to leadership with a predefined cadency is crucial to keep stakeholders in the loop; it is also a good way to seek feedback and guide future iterations of the process.

## Recap

Identifying and solving security issues is the goal of a proactive security team. Introducing new tools to the process is just a consequence, not the end goal. 

I hope this post didn't discourage you from introducing SAST to your organization. It is a great technique that can make your organization more secure and resilient when implemented correctly. If you have comments, suggestions or simply disagree with this approach I would love to have a conversation about it. As always please reach it via email or twitter, see you next time!
