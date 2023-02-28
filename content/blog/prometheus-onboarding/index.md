---
title: Prometheus onboarding
date: "2023-02-27T08:00:00.284Z"
description: "Let's go over concepts that can make using Prometheus more intuitive as a new user."
---

[Prometheus](https://prometheus.io/) is an open-source systems monitoring and alerting toolkit. It collects and stores its metrics as time series data, i.e. metrics information is stored _with the timestamp_ at which it was recorded, alongside optional key-value pairs called labels.

**Disclaimer**

I'm only covering Prometheus from an end-user perspective. This means we will investigate concepts related to metrics and querying while completely skipping infrastructure topics like installation, configuration or instrumentation.

## Intro

Recently I've been migrating dashboards from Datadog to Prometheus, the goal of this post is to showcase concepts that could have helped me understand how to better query and represent metrics in Prometheus.

## Queries and Vectors

Having grasped the terminology early on would have helped me understand why certain queries were not working or returning unexpected results.

* `query` or `range_query` are API calls fetching data
* `instant vector` or `range vector` is the shape of the data returned by your queries

In Prometheus we have one of the following combinations:

#### Query returning an instant vector

This is a query that returns a single vector containing a timestamp and the value associated with this timestamp _for each
combination of labels_ we are querying for.

Suppose we have a `counter` (some value that can only go up) called `products_sold_total` and that we have two distinct instances in our application. Querying for the following:

```ruby
products_sold_total
```

Would produce something like:

| Name  | Counter |
| :-------| :---- |
| products_sold_total{"instance"="a"}   |  1000    |
| products_sold_total{"instance"="b"}   | 834     |

#### Query returning a vector of instant vectors

You can think of this combination as running a query that returns an instant vector multiple times in distinct timestamps.

**This result can be graphed** since Prometheus can use each value per timestamp.

#### Query returning a range vector

This is a query that returns a vector containing multiple timestamps with its associated values. It is important to mention that these events are still nested under a **single timestamp**. This is the return of a query like:

```ruby
products_sold_total[1m]
```

The value `[1m]` means that we want all events happening in the range `timestamp + 1m`. Let's see what this would return:

| Name  | Counter |
| :-------| :---- |
| products_sold_total{"instance"="a"} | [1000@1677381615,|
|                                     | 1002@1677381630, |
|                                     | 1003@1677381645, |
|                                     | 1007@1677381700] |
|                                     |                  |
|                                     |                  |
| products_sold_total{"instance"="b"} | [834@1677381615, |
|                                     | 837@1677381630,  |
|                                     | 840@1677381645,  |
|                                     | 845@1677381700]  |

Where the counter is represented as `[<value_1>@<timestamp_1>, ..., <value_n>@<timestamp_n>]`. In other words, it is now a vector containing a _range_ of events.

#### Query returning a vector of range vectors

You can think of this combination as running a query that returns a range vector multiple times in distinct timestamps.

We **cannot graph this result** since Prometheus cannot use multiple values for a single timestamp. Remember that every range vector is still nested under a timestamp.

If you are a visual person, suppose our range is `[3s]` and we are starting on `T1` (timestamp at second 1), this is how I visualize the data:

```ruby
[
  T1-3: [event_1, event_2, ..., event_n], # Where T1-3 represents the timestamp from second 1 to 3
  T2-4: [event_1, event_2, ..., event_n], # Where T2-4 represents the timestamp from second 2 to 4
  T3-5: [event_1, event_2, ..., event_n], # ...
  T4-6: [event_1, event_2, ..., event_n]  # ...
]
```

So we have a vector of range vector elements.

**What can we do in this case to graph results?**

We would need to use a function like `rate` to aggregate this range of events into an average. This would result in a single timestamp containing a single value symbolizing the growth rate of our counter under that particular time frame. In summary, we transformed our result into multiple **instant vectors**.

**Which range should I use?**

1. We are mostly interested in using `$__rate_interval` when dealing with the `rate()` function.
2. We are mostly interested in using `$__range` when displaying a simple counter (no graphs).
   - It will provide a single range vector containing all the events for the time window we are inspecting.

What about `$__interval`? I'm mostly ignoring it for now since `$__rate_interval` seems to cover everything `$__interval` does and also addresses some downsides of using it.

I highly recommend [this blog post](https://grafana.com/blog/2020/09/28/new-in-grafana-7.2-__rate_interval-for-prometheus-rate-queries-that-just-work/) for this particular topic.

## Mental model for queries

The way I'm currently thinking about queries is by using the following mental model:

- `[]` (`[1m]`, `[10m]`, ..) affects the API call that will return the data
- `{}` (`products_sold_total{instance="a"}`) filters the data returned by our API call
- Functions like `rate()` or `sum()` modifies the data returned by our API call

Knowing that, these are the troubleshooting steps I follow:

1. Is my query returning the expected data?
   - If not, then I need to play with the `[]` and the time window I'm inspecting
   - If yes, go to the next step
2. The data is correct, but my graph is not showing the expected result
   - Play with the `{}` to make sure I'm filtering the data correctly
   - Investigate the functions I'm using to make sure they are returning the expected result

## Scrape interval, Interval, Steps

[This video](https://www.youtube.com/watch?v=09bR9kJczKM) is a **great** intro into the subject and also does an amazing job at explaining rates, queries and pretty much every subject that this post mentioned so far.

## Sum of rate

And by this I'm talking about a query like the following:

```ruby
sum(rate(products_sold[1m]))
```

Suppose our web application has three different instances, each with a distinct `rate`:

| Name  | Rate |
| :-------| :---- |
| products_sold_total{"instance"="a"} | 30.2 |
| products_sold_total{"instance"="b"} | 11.7 |
| products_sold_total{"instance"="c"} | 20.1 |

`sum()` will merge these into a single rate and produce the total: `30.2 + 11.7 + 20.1`.

If our metric had multiple dimensions (labels) we could tell `sum()` to operate in a subset of these dimensions. Let's say we have multiple `flows` to sell a product and these were represented in our metrics with the label `flow`. We could do:

```ruby
sum by (flow) (rate(products_sold[1m]))
```

And this would `sum()` the rate value of distinct flows while aggregating every other dimension (label).

The [aggregation operators](https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators) section helped me with the syntax and examples.

## Metric types

One of the first things I should have done is investigate the characteristics of each [metric type](https://prometheus.io/docs/concepts/metric_types/) in depth. There are not too many, but each one has their own characteristics and constraints. Let's see some problems that I've faced due to my lack of understanding of some of these metric types.

### Counter

It can produce decimal numbers for slow counters (not too many events) under a time range since Prometheus extrapolates these events to smooth things out and produce the correct result in aggregate. See [this issue](https://github.com/prometheus/prometheus/issues/3746) for more context.

#### Gauge

We can use a gauge metric type to count things, but since it can go up or down we cannot use functions like `rate()` or `increase()`.

#### Histogram

Before anything, please make sure your buckets are configured according to the values your application expects. For example, if your application makes HTTP requests to an API and they usually take `200ms`, having buckets that starts at `300ms` will make your metrics mostly useless since 99% of your requests will be part of the first bucket, making it impossible to measure the true `pX` (p50, p95, p99. ..) values.

Histogram's in Prometheus are **cumulative**. Suppose we had a histogram like the following:

| Bucket  | Count |
| :-------| :---- |
| 100ms   | 5     |
| 200ms   | 3     |
| 300ms   | 10    |

In Prometheus this is represented as:

| Bucket  | Count |
| :-------| :---- |
| 100ms   | 5     |
| 200ms   | 8     |
| 300ms   | 23    |

The `200ms` bucket will hold values from its own bucket + the `100ms` bucket, while the `300ms` bucket will hold values from its own bucket + every other bucket lower than it. This can be rally confusing at first when we are just starting to build our dashboards.

## Anything else?

It's still early days in my Prometheus journey, if I'm misinterpreting things or missing crucial information please reach out to me and I will gladly adjust this post. I would also appreciate if you share resources that helped you along your journey, there's also something new to be learned!
