---
title: Discovering ECB block sizes
date: "2021-07-03T16:35:00.284Z"
description: "How do we figure out the block size of a message encrypted with ECB?"
---

Building up on our previous [ECB decryption post](/ecb-decryption-simple) we will be figuring out one of the missing pieces of the challenge.

> Given a prefix controlled message padded with PKCS7 and encrypted with ECB , how do we figure out the block size?

We barely touched upon _PKCS7_ and this this seems like a good opportunity to go over it. _PKCS7_ is a padding algorithm that allow us to encrypt irregularly-sized messages, or in less fancy terms, it allows us to encrypt messages that don't have a length that is a multiple of our block size.

The algorithm works like the following [per the spec](https://datatracker.ietf.org/doc/html/rfc2315#section-10.3):

```
       01 -- if l mod k = k-1
    02 02 -- if l mod k = k-2
        .
        .
        .
k k ... k k -- if l mod k = 0

The padding can be removed unambiguously since all input is
padded and no padding string is a suffix of another.
```

<br />

Let's use an example to make things clearer. Suppose the `last block` of our message is `[97, 98]` and the block size is `4`.

1. Using `l mod k` we end up with `2 mod 4 = 2`
   - `l` is the size of our last block (`[97, 98]`), which is `2`
   - `k` is our block size, which is `4`
2. Now we know that we have to pad the last block with two bytes, so the end result is:
   - `[97, 98, 2, 2]`

There's one detail that a lot of folks miss. When the size of the last block is already correct the algorithm above adds a new block to the end as padding. So when we have the last block as `[97, 98, 99, 100]` and our block size is `4` we will end up with:

1. Using `l mod k` we end up with `4 mod 4 = 0`
2. When the result is zero we pad a full block size, so we end up with:
   - `[97, 98, 99, 100] and [4, 4, 4, 4]`

Let's implement it in Ruby:

```rb
# See https://tools.ietf.org/html/rfc2315#section-10.3
def pkcs7_pad(message:, block_size:)
  raise 'Invalid block size' if block_size >= 256 # as per the PKCS7 spec

  size = block_size - (message.size % block_size)
  padding = Array.new(size, size)
  message + padding
end

message = 'ab'.bytes
puts pkcs7_pad(message: message, block_size: 4).inspect
# => [97, 98, 2, 2]

message = 'abcd'.bytes
puts pkcs7_pad(message: message, block_size: 4).inspect
# => [97, 98, 99, 100, 4, 4, 4, 4]
```

## Figuring out the block size

We will work with the `encryption_oracle` method from our [previous post](/ecb-decryption-simple). Let's revisit it:

```rb
RANDOM_KEY = 16.times.map { rand(0..255) }
UNKNOWN_BUFFER = File.read('unknown_buffer').strip.bytes

def encryption_oracle(prefix)
  # Now we know what this method does :)
  padded_buffer = pkcs7_pad(
    message: prefix + UNKNOWN_BUFFER,
    block_size: 16
  )

  aes_ecb_encrypt(padded_buffer, RANDOM_KEY)
end
```

The algorithm we will need to implement is:

1. Feed identical bytes to the `encryption_oracle` method, one at a time
   - Example, start with 1 byte ("A"), then "AA", then "AAA" and so on.
2. Every time you do it take note of the `first block` of the result
3. Once two prefixes produce the `SAME first block` we have discovered our block size which is equal to the `number of iterations`

It's time for a contrived example!

### Contrived example

Suppose our message is composed of `[0, 1, 2, 3, 4]` and our block size is `FOUR`, but we don't know it yet.

**Iteration one:**

1. Let's feed our original message an _iteration_ number of `A`s:
   - `[41, 0, 1, 2, 3, 4, 2, 2]` (the last two bytes came from PKCS7)
2. Encrypt the value above and store it
3. Let's feed our original message an _iteration plus one_ number of `A`s:
   - `[41, 41, 0, 1, 2, 3, 4, 1]` (the last byte came from PKCS7)
4. Encrypt the value above and store it

_Is the first block of steps one and three the same?_ They are not!

- Step 1 first block: `[41, 0, 1, 2]`
- Step 3 first block: `[41, 41, 0, 1]`

**Iteration 2**

1. Let's feed our original message an _iteration_ number of `A`s:
   - `[41, 41, 0, 1, 2, 3, 4, 1]`
2. Encrypt the value above and store it
3. Let's feed our original message an _iteration plus one_ number of `A`s:
   - `[41, 41, 41, 0, 1, 2, 3, 4, 4, 4, 4, 4]`
4. Encrypt the value above and store it

_Is the first block of steps one and three the same?_ They are not!

- Step 1 first block: `[41, 41, 0, 1]`
- Step 3 first block: `[41, 41, 41, 0]`

**Iteration 3**

1. Let's feed our original message our _iteration_ number of `A`s:
   - `[41, 41, 41, 0, 1, 2, 3, 4, 4, 4, 4, 4]`
2. Encrypt the value above and store it
3. Let's feed our original message our _iteration plus one_ number of `A`s:
   - `[41, 41, 41, 41, 0, 1, 2, 3, 4, 3, 3, 3]`
4. Encrypt the value above and store it

_Is the first block of steps one and three the same?_ They are not!

- Step 1 first block: `[41, 41, 41, 0]`
- Step 3 first block: `[41, 41, 41, 41]`

**Iteration 4**

1. Let's feed our original message our _iteration_ number of `A`s:
   - `[41, 41, 41, 41, 0, 1, 2, 3, 4, 3, 3, 3]`
2. Encrypt the value above and store it
3. Let's feed our original message our _iteration plus one_ number of `A`s:
   - `[41, 41, 41, 41, 41, 0, 1, 2, 3, 4, 2, 2]`
4. Encrypt the value above and store it

_Is the first block of steps one and three the same?_ They are!

- Step 1 first block: `[41, 41, 41, 41]`
- Step 3 first block: `[41, 41, 41, 41]`

We had **4 iterations**, so that's our block size!

### Why this work?

It only works because ECB produces the _same ciphertext given the same plaintext_, and the last two iterations end up producing the same `first block` since they are the same plaintext (both are `[41, 41, 41, 41]`).

If ECB didn't produce the same ciphertext we would have no way to compare whether both blocks are the same or not.

### Implementation

```rb
BYTE = 'A'.ord # 41

def infer_block_size
  (1..256).each do |count|
    iteration_0 = encryption_oracle(Array.new(count, BYTE))
    iteration_1 = encryption_oracle(Array.new(count + 1, BYTE))

    if iteration_0.slice(0, count) == iteration_1.slice(0, count)
      return count
    end
  end
end
```

And we have reached the end of our exercise! Congratulations, take a moment to be proud of what you have achieved and I hope you are looking forward to the next posts as much as I am. :)
