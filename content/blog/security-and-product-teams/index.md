---
title: Application Security and product teams
date: "2022-07-26T12:30:00.284Z"
description: "Or what could AppSec learn from product teams?"
---
 
Product teams have evolved a lot in the past decade or so, coming up with a refined process in order to provide value to a target audience in the shortest amount of time. Each product is backed by data which is then pulled apart to measure dimensions like engagement or adoption, which in turn drive the next iteration of the product. The best product teams know their target audience by heart and have clear value propositions tailored to that audience. And while there are downsides to this approach like pressure to deliver through unrealistic deadlines, Application Security could learn a thing or two from product teams.
 
Let's dive into things that are frequently overlooked by Application Security and see how we could benefit from adopting, or at least considering those areas as valuable input. Before we start I would like to mention that this should not be treated as a binary approach (all or nothing), different Application Security products will have distinct needs.
 
## Market Segment
 
Who is the audience of your project? Answering this question early on will help the team to decide which tradeoffs to make and what they should optimize for. Are we catering to developers? A particular industry? Smaller organizations? Large organizations? It is not uncommon for security initiatives to fail because they cater to an audience that is not technical, but still require a lot of technical knowledge through fine tuning or customizations. Another big way security products fail is by _assuming_ knowledge about their target audience without prior research.
 
The more fine grained your audience is, the more you can understand their needs and how they can be addressed. While it's completely fine to appeal to a broader audience, the initiative should still be tailored to a core audience.
 
## Value proposition
 
Having a deep understanding of the domain and the problem being solved is not enough. Knowing how to explain the value of your product and the actual problem being solved in a way that connects to your core audience is equally if not more important. This is tightly related to the brand of the product, which is an area rarely mentioned within AppSec. As a rule of thumb if you need another AppSec engineer to explain the value of your product it's highly likely that your product will not gain traction unless your core audience is AppSec engineers themselves.
 
**Do not assume** you know what your core audience needs, doing some customer research early on goes a long way to prevent the product from focusing on the wrong things.
 
## Minimum Viable Product (MVP)
 
After identifying the value proposition, what is the minimum set of features you can provide your customers? The faster the product can validate that their value proposition and market segment are correct the higher the chances of that product succeeding. Product teams often prototype something quick and throw it away once their value proposition is validated. AppSec teams can employ the same technique, but they should be careful to manage stakeholder expectations in order to not lose trust. Cutting corners without a clear action plan has bigger consequences for AppSec.
 
## User Experience
 
I will loosely use the term user experience as the ability for customers to use the product independently of where in their journey they are. As a new customer adopting the product, how much work is expected from them to get started? Do they need to refer to documentation or reach out in another channel (Slack channels, email, phone, etc) for support? Can someone experienced with the product customize it to better fit their needs? These should all be conscious decisions before releasing the product.
 
As a rule of thumb the easier the product is from the get-go ("no config" and good defaults) the more it will gain traction. Allowing it to be customized _after_ customers are familiar with it will create a loyal customer base and increase customer retention. In other words, try to defer complexity to the later stages of the customer journey.
 
Before we finish this section we should mention "breaking changes". One of the main reasons for customer retention are customers feeling that they have mastered your product. Shipping breaking changes force customers to go back on their learning journey and give them the perfect opportunity to consider easier alternatives. How many times have you stuck with a product despite a modern one existing just because you know it end to end?
 
## Data
 
Data is a broad topic and has two sides here:
 
1. Data used to drive the product
2. Data provided to customers through product usage
 
### Data used to drive the product
 
Are decisions to add, modify or remove a feature backed by data? When a new version of the product is released, can adoption and feature usage be measured? Is customer feedback being collected? All of these questions can help the product be successful and stay relevant for the long term. This will also enable continuous experimentation within the product. Pay attention to your early adopters and product advocates' feedback, they are a driving force that can help the product be adopted by a larger audience.
 
Having data is half of the battle, knowing what to measure is the other half. Ideally this data should be used to measure predetermined desired outcomes.
 
### Data provided to customers through product usage
 
Can customers introspect and verify the claims made by the product through usage? Do they have access to dashboards and reports? This is a critical step to build trust and customer loyalty. Most of the time customers will have their own stakeholders and providing _digestible data_ will help them justify paying for the product.
 
## Semgrep as a real life example
 
I will talk about `r2c` product called [Semgrep](https://semgrep.dev) since I've been following its development for a while. I'm in no way affiliated with the company or product, but I admire the team's ability to execute and engage with the community.
 
Semgrep very early on identified its core audience as developers interested in static analysis, but they also cater to organizations as broader market segment. Its landing page has their value proposition in a very clear manner, the main one being: "provide static analysis at ludicrous speed", followed by ways it can achieve that goal like providing public rules and supporting a variety of programming languages, these are also called the _core diferentiators_ of the product. Below the list of core differentiators we see companies already using Semgrep, which acts as a social proof and makes you wonder if your own organization can also benefit from it.
 
The main areas where in my opinion Semgrep did really well are `User Experience`, building a great `Minimum Viable Product` and using a `data driven development` approach.
 
### MVP
 
`r2c` released their product with a subset of the programming languages they provide today and a much simpler version of their rule engine. The same can be said about their public rules, documentation and even their playground which didn't have an advanced option at the time. Despite that, the core functionality was there from the get go and it was clear to me (the audience) the value that Semgrep was aiming to provide.
 
### User Experience
 
This is the core of their product and can be felt through well written documentation, an interactive playground where we can test rules and a very supportive community in Slack. As a customer I can start using Semgrep just by relying on their public rules and once I'm familiar with the product I'm able to extend it to create rules that fits my own needs. Remember the rule of thumb to defer complexity to the later stages of the customer journey? Semgrep executed really well here with defaults that work just fine for someone that is exploring their product for the first time.
 
Another point worth mentioning is that despite the fact that Semgrep constantly pushes new features and improvements, it doesn't force the user to relearn how to use their product since the core experience remains the same.
 
### Data
 
A lot of new features are still being added to the product and some of those were flagged by the community. The interesting part here is that having a good user experience allowed `r2c` to build an engaged community that provides valuable feedback and advocates for the product. An area where I feel Semgrep could still improve on is providing more data to their customers in their CLI, for example, flagging rules that don't have tests associated with it.
 
## Recap
 
AppSec is still in the early stages of shipping products and can benefit a lot from lessons that product teams have already internalized. My expectation is that in the next decade or so we will see a lot of exciting products in this space that have mastered these basics. If you have an opinion on this subject I would love to have a chat with you, please reach out!
