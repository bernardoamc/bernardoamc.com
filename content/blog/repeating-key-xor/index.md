---
title: Repeating-key XOR
date: "2021-06-12T18:35:00.284Z"
description: "Implementing and breaking the repeating-key XOR algorithm"
---

In this post we will learn what repeating-key XOR is, followed by learning how to implement it and by the end of it we will have the knowledge we need to reverse engineer the algorithm.

## How does repeating-key XOR works?

As the name implies, the idea behind this algorithm is _repetition_, but let's start from the beginning.

**In order to perform this algorithm we need the following things in place:**

1. A `key` to XOR our message with
2. A `buffer` of bytes representing our message

**The algorithm consists of the following steps:**

1. Sequentially `XOR` each byte of the key with the corresponding byte of the message
2. When we exhaust the bytes in our key we simply _repeat it_

I find it helpful to visually represent these operations, so let's work with an example!

Suppose our _key_ is `ZAP` and our _message_ is `WEIRDMSG`. The algorithm would be performed in the following order:

| Key | Operation | Byte |
| :-- | :-------- | :--- |
| Z   | XOR       | W    |
| A   | XOR       | E    |
| P   | XOR       | I    |
| Z   | XOR       | R    |
| A   | XOR       | D    |
| P   | XOR       | M    |
| Z   | XOR       | S    |
| A   | XOR       | G    |

## Implementation

With the intuition in place, let's build this. We will be using `Ruby` for this task, but any other programming language would suffice.

```ruby
# Remember that we need to XOR bytes, not characters.
KEY = 'ZAP'.bytes # [90, 65, 80]
MESSAGE = 'WEIRDMSG'.bytes # [87, 69, 73, 82, 68, 77, 83, 71]

def repeating_key_xor(buffer, key)
  key_size = key.size

  buffer.map.with_index(0) do |byte, index|
    byte ^ key[index % key_size]
  end
end

puts repeating_key_xor(MESSAGE, KEY).inspect
# [13, 4, 25, 8, 5, 29, 9, 6]
```

## Reverse engineering a message encoded with repeating-key XOR

Now that we know how to implement the algorithm, how would we reverse engineer it?

Let's assume we have the following:

1. Encoded message
2. We know the message is in English
3. Key length is known (we can figure the length if we didn't have it, but we will leave this part for a future exercise)

The intuition behind solving this problem is that we know _which bytes from the key were XORed with which bytes from the message_! Using our example from above we have the following distribution:

| Key byte | Blocks    |
| :------- | :-------- |
| Z        | [W, R, S] |
| A        | [E, D, G] |
| P        | [I, M]    |

It's worth repeating, each block was XORed using the _same byte_.

Knowing the above and that the message is in English allows us to start _guessing_ which bytes were XORed with the message! Ideally when we XOR our guess with the encoded message it will output something similar to English.

So we have a plan:

1. For each `block`, the single-byte XOR key that produces the best looking `English letter histogram` is the repeating-key XOR key byte for that block
2. Put the single-byte found for each block together and we have our key

**Why does this work?**

Most languages can be represented as a `letter frequency table`, which is the number of times letters of the alphabet appear on average in the written language. By comparing our decoded message using the guessed byte against this table we can be reasonably sure when our guessed byte results in something resembling English.

With this intuition in place, let's see the full algorithm:

1. Break the encoded message (ciphertext) into blocks of `key size length`
   - Remember to pad the last block so it ends up having the same length of every other block
2. Now transpose the blocks: make a block that is the first byte of every block, and a block that is the second byte of every block, and so on. This will resemble the table used in our `ZAP` example
3. Fetch the byte that produces the best score for each block (a byte has 8 bits, so it's value can go from 0 up to 255)
4. Put the derived byte for each block together and we have our key

## Reverse engineering implementation

```ruby
# In real life we wouldn't know the PLAINTEXT or the KEY, but it's useful to compare the output of our algorithm with the real PLAINTEXT.
PLAINTEXT = <<-PLAINTEXT
It’s Cuz of that !W#$ ‘pizza’ that everyone down here is suffering. – Barret Wallace
It’s like this train. It can’t run anywhere except where its rails take it. – Cloud Strife
Words aren’t the only thing that tell people what you’re thinking. – Tifa Lockheart
What you pursue will be yours, but you will lose something dear - Cait Sith/Reeve Tuesti
Our battlefield is now beneath the earth...The gate to tomorrow is not the light of heaven, but the darkness of the depths of the earth. - Vincent Valentine
How can there be any meaning in the memory of such a being? What I have shown you is reality. What you remember, that is the illusion. - Sephiroth
I just want to do everything in my power to help. All of you - and the planet. - Aerith Gainsborough
I don't like two-legged things. - Red XIII/Nanaki
Survival can be a matter of luck or skill. And you can't rely on luck. - Cloud Strife
PLAINTEXT
KEY = 'SECRET'.bytes

# The repeating_key_xor method was obtained from the implementation section
ciphertext = repeating_key_xor(PLAINTEXT.bytes, KEY)

# Step 1 of the algorithm
blocks = ciphertext.each_slice(KEY.size).to_a

# Right padding the last block with nils so all blocks have the same length.
# This way we can transpose blocks successfully.
required_padding = blocks.first.size - blocks.last.size
blocks[-1] = blocks.last + Array.new(required_padding, nil)

# Step 2 of the algorithm
# Now we cluster bytes that have been XORed by the same byte together with transpose
# and start our guesswork.
potential_key = blocks.transpose.map do |cluster|
  # Step 3 of the algorithm
  scored_guesses = (0..255).map do |guess|
    result = cluster.compact.map do |b|
      b ^ guess
    end.pack('C*')

    score = english_score(result) # See implementation by the end of the post
    [score, guess]
  end

  # Figuring out the byte that produces the best score, ending step 3.
  scored_guesses.max_by { |score, _| score }.last
end.pack('C*') # The byte packing is step 4, this will produce a string from our bytes.

puts "Potential key: #{potential_key}"

decoded_message = repeating_key_xor(
    ciphertext,
    potential_key.bytes
).pack('C*')

puts "Decoded: #{decoded_message}"
```

And that's it!

**Attention:** If your plaintext is _small_ you will probably need to get something like the top 5 highest scores and test those keys since the algorithm might not have enough data to make the proper decision.

### Scoring the plaintext against english

Now it's time to see what that method `english_score` is all about! This is likely not the most precise implementation, but it will suffice for our exercise.

```ruby
ENGLISH_FREQUENCY = {
  ' ' => 0.14,
  'e' => 0.12,
  't' => 0.09,
  'other' => 0.09,
  'a' => 0.08,
  'o' => 0.07,
  'i' => 0.06,
  'n' => 0.06,
  's' => 0.06,
  'h' => 0.06,
  'r' => 0.05,
  'd' => 0.04,
  'l' => 0.04,
  'c' => 0.02,
  'u' => 0.02,
  'm' => 0.02,
  'w' => 0.02,
  'f' => 0.02,
  'g' => 0.02,
  'y' => 0.01,
  'p' => 0.01,
  'b' => 0.01,
  'v' => 0.01,
  'k' => 0.01,
  'j' => 0.01,
  'x' => 0.00,
  'q' => 0.00,
  'z' => 0.00
}.freeze

# Build a letter frequency table from a String
def frequency_table(string)
  frequency = Hash.new { |h,k| h[k] = 0 }
  len = string.size

  string.each_char do |character|
    bucket = ENGLISH_FREQUENCY.key?(character) ? character : 'other'
    frequency[bucket] += 1
  end

  frequency.each { |k,v| frequency[k] = v.to_f / len }

  frequency
end

def chi_squared(expected_frequency, computed_frequency)
  expected_frequency.map do |letter, expected_value|
    computed_value = computed_frequency[letter] || 0
    next 0 if expected_value.zero?
    (expected_value - computed_value) ** 2 / expected_value
  end.sum
end

def english_score(string)
  computed_frequency = frequency_table(string)
  1 / chi_squared(ENGLISH_FREQUENCY, computed_frequency)
end
```

And we have reached the end of our exercise! I hope it was helpful, if anything is confusing or could be improved please reach out to me on Twitter or by email.
