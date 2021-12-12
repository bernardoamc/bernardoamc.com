---
title: Mathematically solving Advent of Code 2021 day 06
date: "2021-12-10T18:00:00.284Z"
description: "Where we end up using matrices and exponentiation by squaring to model a linear recurrence."
---

[Advent of Code](https://adventofcode.com/2021/about) also called `AoC` is a set of small programming puzzles that are released daily from December 1st up till December 25th and that can be solved in any programming language you like. What I find particularly interesting about it is that the community is very active and you can always reach out for help or to compare solutions after you have solved a particular puzzle.

Today we will chat about [the puzzle](https://adventofcode.com/2021/day/6) that we had on `day 6`. After solving a puzzle I usually go to the [Reddit thread](https://www.reddit.com/r/adventofcode/comments/r9z49j/2021_day_6_solutions/) of that day to check for alternative solutions. It's there that I noticed that this puzzle could have been solved using matrix exponentiation and it took me some time to understand how that worked. This post is my attempt to explain this interesting solution.

### Introduction

In this problem we are asked to model a population of `fish`. The model works like the following:

1. Each fish is represented by a `number`, which is the amount of days before reproduction.
2. This number decreases each day
3. Once it reaches `0`, on the next day, two things will happen:
   - that fish number is reset to `6`
   - and a _new fish_ with a value of `8` is created

This means that a fish reproduces every 7 days, and that each new fish needs 2 more days when they are created.

### Example

Suppose our input is the following: `3,4,3,1,2`

Remember that each number represents the state of a single fish.

Let's _sort this input_ and manually compute this population after _five days_:

```
Initial state: 1,2,3,3,4
After  1 day:  0,1,2,2,3
After  2 days: 0,1,1,2,6,8
After  3 days: 0,0,1,5,6,7,8
After  4 days: 0,4,5,6,6,6,7,8,8
After  5 days: 3,4,5,5,5,6,6,7,7,8
```

So after _five days_ we have `ten` fish. The state of each fish doesn't matter when we are computing the final population count.

Here's the interesting leap. Since we know that a `fish` can have a state between `0` and `8` we can represent that same information using a `matrix`. Each column represents a possible state of a fish and we can compute the amount of fish in that state each day. As a side note a `1 by N` matrix (1 row with N columns) is usually called a `vector`.

Our input is still `3,4,3,1,2`, let's write it in a `matrix` form:

```
               0,1,2,3,4,5,6,7,8
Initial state: 0,1,1,2,1,0,0,0,0
```

This means we have:

- One fish in state `1`
- One fish in state `2`
- Two fish in state `3`
- One fish in state `4`
- No fish in any other state

Let's manually compute the population after _five days_ in `matrix` form:

```
               0,1,2,3,4,5,6,7,8
Initial state: 0,1,1,2,1,0,0,0,0
After  1 day:  1,1,2,1,0,0,0,0,0
After  2 days: 1,2,1,0,0,0,1,0,1
After  3 days: 2,1,0,0,0,1,1,1,1
After  4 days: 1,0,0,0,1,1,3,1,2
After  5 days: 0,0,0,1,1,3,2,2,1
```

And the answer is the sum of fish in each state: `0 + 0 + 0 + 1 + 1 + 3 + 2 + 2 + 1` = `10`.

### Solution

We need to find a `new matrix` that when multiplied with our existing `matrix` will give us the state of the `next day`. Let's visualize this where `M` is our new matrix:

```
       Initial State           Day 01
M * (0,1,1,2,1,0,0,0,0) = (1,1,2,1,0,0,0,0,0)

          Day 01               Day 02
M * (1,1,2,1,0,0,0,0,0) = (1,2,1,0,0,0,1,0,1)

          Day 02               Day 03
M * (1,2,1,0,0,0,1,0,1) = (2,1,0,0,0,1,1,1,1)
```

There's a [linear recurrence relation](https://en.wikipedia.org/wiki/Recurrence_relation) here, what we want in a general way is:

```
M * (a,b,c,d,e,f,g,h,i) = (b,c,d,e,f,g,h+a,i,a)
```

Or in plain English:

- `state A` becomes `state B`
- `state B` becomes `state C`
- `state C` becomes `state D`
- `state D` becomes `state E`
- `state E` becomes `state F`
- `state F` becomes `state G`
- `state G` becomes `state H` plus `state A`
- `state H` becomes `state I`
- `state I` becomes `state A`

Does this make sense? Every day the fish state decreases by one and a fish in state `0` will go back to state `6` and also generate a new fish in position `8`.

Let's run this transformation from `day 01` to `day 02` and see if this makes sense:

```
M * (a,b,c,d,e,f,g,h,i) = (b,c,d,e,f,g,h+a,i,a)
M * (1,1,2,1,0,0,0,0,0) = (1,2,1,0,0,0,0+1,0,1)
```

Seems about right! But how do we find `M` now? Luckily for us that's the easy part, having the insight and identifying the linear recurrence was the hard part! What we want is:

```
Make state A become state B:
(0 * a) + (1 * b) + (0 * c) + (0 * d) + (0 * e) + (0 * f) + (0 * g) + (0 * h) + (0 * i)

Which becomes:
(1 * b)
```

So we have figured out the first line of our `M` matrix.

```
0 1 0 0 0 0 0 0 0
```

Let's figure out the second line:

```
Make state B become state C:
(0 * a) + (0 * b) + (1 * c) + (0 * d) + (0 * e) + (0 * f) + (0 * g) + (0 * h) + (0 * i)

Which becomes:
(1 * c)
```

And we have the second line of our `M` matrix.

```
0 1 0 0 0 0 0 0 0
0 0 1 0 0 0 0 0 0
```

And doing that for each state yields the final `M` matrix!

```
┏                 ┓
┃0 1 0 0 0 0 0 0 0┃
┃0 0 1 0 0 0 0 0 0┃
┃0 0 0 1 0 0 0 0 0┃
┃0 0 0 0 1 0 0 0 0┃
┃0 0 0 0 0 1 0 0 0┃
┃0 0 0 0 0 0 1 0 0┃
┃1 0 0 0 0 0 0 1 0┃
┃0 0 0 0 0 0 0 0 1┃
┃1 0 0 0 0 0 0 0 0┃
┗                 ┛
```

So that's how we could calculate `day 01` from our `initial state`:

```
┏                 ┓     ┏ ┓
┃0 1 0 0 0 0 0 0 0┃     ┃0┃
┃0 0 1 0 0 0 0 0 0┃     ┃1┃
┃0 0 0 1 0 0 0 0 0┃     ┃1┃
┃0 0 0 0 1 0 0 0 0┃     ┃2┃
┃0 0 0 0 0 1 0 0 0┃  X  ┃1┃
┃0 0 0 0 0 0 1 0 0┃     ┃0┃
┃1 0 0 0 0 0 0 1 0┃     ┃0┃
┃0 0 0 0 0 0 0 0 1┃     ┃0┃
┃1 0 0 0 0 0 0 0 0┃     ┃0┃
┗                 ┛     ┗ ┛
```

By the way, our matrix `M` is similar to a [permutation matrix](https://en.wikipedia.org/wiki/Permutation_matrix), but adjusted to model our fish population (two ones in the first column as opposed to just one).

Now you might be asking yourself, "isn't this much harder than programmatically solving this?" and you wouldn't be wrong in my opinion! But this solution has benefits, for example, if you want to calculate the fish population after **a million** days we could compute this as:

```
M^1_000_000 * Initial State
```

And we know this problem can be efficiently solved by using [exponentiation by squaring](https://en.wikipedia.org/wiki/Exponentiation_by_squaring). Let's use numbers to keep the explanation simpler, but using a matrix works in the exact same way.

Let's say we want to compute a number like `2^22`. The insight of fast exponentiation is that this can be broken down into:

- `2^16 * 2^4 * 2^2`

And can calculate a table like the following:

```
| Exponent | Representation |
| -------- | -------------- |
| 2^0      | 1              |
| 2^1      | 2              |
| 2^2      | 2^1 * 2^1      |
| 2^4      | 2^2 * 2^2      |
| 2^8      | 2^4 * 2^4      |
| 2^16     | 2^8 * 2^8      |
```

So every row in the table can be computed by the previous row (recursively). For example, in order to compute `2^16` we only need four multiplications as opposed to sixteen! The idea is the same with matrices, we can compute each state based on the previous state instead of multiplying everything.

The result would be `O(Log n)` as opposed to `O(n)` arithmetic operations.

### Recap

1. We noticed that it was possible to model our fish population as a matrix
2. We established a linear recurrence between days
3. We represented this linear recurrence as a permutation matrix
4. By using exponentiation by squaring we can compute our final answer in `O(Log n)` as opposed to `O(n)`

That was a really interesting exploration! AoC puzzles are a great way to practice solutions that I wouldn't reach out to on a daily basis. Thank you for reading, as always you can reach me via email or twitter for questions or comments, see you next time!
