---
title: Breaking CTR with fixed nonce
date: "2021-09-05T12:15:00.284Z"
description: "In this post we will investigate how multiple ciphertexts encrypted with a fixed nonce in CTR mode can be attacked."
---

In this post we will investigate the "break fixed-nonce CTR" exercise from [Cryptopals](https://cryptopals.com/sets/3/challenges/20). It's helpful to read the problem statement before reading this blog post and I highly recommend attempting the previous exercises yourself as they do a great job ramping up your knowledge on the subject. We also have a [previous post](/ctr-mode-introduction) explaining how `CTR` works.

In this exercise we are presented with 40 CTR-encrypted ciphertexts and we know that each of them were encrypted under the same `nonce`.

In CTR a `nonce` is just a random value that will be concatenated with a `counter`, both are usually 8 bytes each. Once these two values are concatenated they will be encrypted under `AES-128-ECB` and then XORed with 16 bytes from our plaintext. As a reminder, here's the full process:

![CTR Encryption by Gwenda](../../assets/ctr_encryption.svg)

## Thought process

We have 40 CTR-encrypted ciphertexts under the same `nonce`, so what's wrong with that? At first I had no idea, so I decided to look closely at the encryption process and try to derive some commonality between this exercise and problems that I have previously solved.

For the sake of simplicity let's imagine that we only have two plaintexts being encrypted under a _fixed nonce and the same key_ and try to encrypt it ourselves:

**Nonce**: `[33, 112, 111, 116, 97, 116, 111, 33]`

**Key**: `[76, 80, 122, 102, 50, 110, 51, 198, 232, 120, 106, 233, 189, 55, 5, 47]` (16 bytes)

**Plaintext 1**: `[115, 117, 112, 101, 114, 115, 101, 99, 114, 101, 116, 109, 101, 115, 115, 97, 103, 101, 100, 111, 110, 116, 112, 101, 101, 107, 112, 108, 101, 97, 115, 101]`

**Plaintext 2**: `[105, 95, 97, 109, 95, 104, 97, 114, 109, 108, 101, 115, 115, 95, 112, 108, 101, 97, 115, 101, 95, 100, 111, 110, 111, 116, 95, 112, 101, 101, 107, 33]`

**Let's see how plaintext 1 would be encrypted:**

The first block will be encrypted with:

1. First we generate the `Nonce + Counter`:
    * `[33, 112, 111, 116, 97, 116, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0]`
2. Now we encrypt this value under `AES-128-ECB` using our `key`.
3. We `XOR` this value with our first block from plaintext 1 to get the ciphertext.

The second block will be encrypted with:

1. First we generate the `Nonce + Counter`:
    * `[33, 112, 111, 116, 97, 116, 111, 33, 0, 0, 0, 0, 0, 0, 0, 1]`
2. Now we encrypt this value under `AES-128-ECB` using our `key`.
3. We `XOR` this value with our second block from plaintext 1 to get the ciphertext.

**Now let's see how plaintext 2 would be encrypted:**

The first block will be encrypted with:

1. First we generate the `Nonce + Counter`:
    * `[33, 112, 111, 116, 97, 116, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0]`
2. Now we encrypt this value under `AES-128-ECB` using our `key`.
3. We `XOR` this value with our first block from plaintext 2 to get the ciphertext.

The second block will be encrypted with:

1. First we generate the `Nonce + Counter`:
    * `[33, 112, 111, 116, 97, 116, 111, 33, 0, 0, 0, 0, 0, 0, 0, 1]`
2. Now we encrypt this value under `AES-128-ECB` using our `key`.
3. We `XOR` this value with our second block from plaintext 2 to get the ciphertext.

**Wait, did you notice anything similar between these encryptions?**

It's totally fine if not, here they are:

1. The first block of plaintext 1 gets XORed with the exact same value as the first block from plaintext 2.
2. The second block of plaintext 1 gets XORed with the exact same value as the second block from plaintext 2.

If you remember our [Repeating Key XOR](/repeating-key-xor) and [Repeating Key XOR II](/repeating-key-xor-ii) posts you will notice that we have the _exact same problem_ in our hands!

Every first block of each CTR-encrypted ciphertext can be cracked using `repeating key XOR`, and we will do the same for each subsequent block.

### Attack

We will approach this problem by doing the following:

1. Concatenate the first 16 bytes of every message, and apply repeating key XOR
2. Concated the next 16 bytes of every message, and apply repeating key XOR
3. Repeat until we exhaust the entire message.

**But not every message has the same length!**

That's ok, we can use the message with the smallest length and apply our attack. We might miss something, but at least we will decrypted the majority of our messages.

Let's see this in code:

```rb
require 'base64'
require 'openssl'

def aes_ecb_encrypt(plaintext, key)
  if !(plaintext.size % 16).zero?
    raise 'Buffer must be composed of 16-byte chunks' 
  end

  cipher = OpenSSL::Cipher.new('AES-128-ECB')
  cipher.encrypt
  cipher.key = key.pack('C*')
  cipher.padding = 0
  result = cipher.update(plaintext.pack('C*')) + cipher.final
  result.unpack('C*')
end

def aes_ctr_encrypt(plaintext, key, nonce)
  blocks = plaintext.each_slice(16)

  blocks.each_with_index.flat_map do |block, counter|
    # Make sure our counter is 8 bytes
    counter = [counter].pack('q<').bytes

    intermediate = aes_ecb_encrypt(nonce + counter, key)
    intermediate = intermediate.take(block.size)

    block.zip(intermediate).map { |a, b| a ^ b }
  end
end

BLOCK_SIZE = 16
NONCE = 0
KEY = 16.times.map { rand(0..255) }

CIPHERTEXTS = [
  # See encoded plaintexts in:
  # https://cryptopals.com/sets/3/challenges/19 
].map do |c|
  aes_ctr_encrypt(
    Base64.decode64(c).bytes,
    KEY,
    NONCE
  ).flatten
end

MIN_LENGTH = CIPHERTEXTS.min_by(&:size).size
ALIGNED_CIPHERTEXTS = CIPHERTEXTS.map do |cipher|
  cipher
    .slice(0, MIN_LENGTH)
    .each_slice(BLOCK_SIZE)
    .to_a
end

# Making every first block of every ciphertext be part of
# the same Array, the second block of every ciphertext part
# of the same Array and so on and so forth.
transposed_blocks = ALIGNED_CIPHERTEXTS.transpose.to_a

keystream = transposed_blocks.flat_map do |blocks|
  blocks.transpose.map do |block|
    max_score = 0
    chosen = ''

    (0..255).each do |candidate|
      result = block.map { |b| b ^ candidate }

      # See https://bernardoamc.com/repeating-key-xor/
      # for the implementation of english_score.
      score = english_score(result.pack('C*'))

      if score > max_score
        max_score = score
        chosen = candidate
      end
    end

    chosen
  end
end.pack('C*')

CIPHERTEXTS.each do |c|
  key = keystream.bytes.slice(0, c.size)
  key_size = key.size

  plain = c.map.with_index(0) do |byte, index|
    byte ^ key[index % key_size]
  end

  puts plain.pack('C*')
end
```
<br/>

And this is all we need to do in order to attack multiple CTR-encrypted ciphertexts under the same nonce! We could refine our `english_score` method to yield even better results and work to decrypt more of the message, but the fact that we can already infer parts of the plaintext with this approach validates the attack.

In future posts we will start exploring the concept of message authentication and potential pitfalls of common implementations. As always please reach out to me via email or Twitter if you have suggestions, questions or just want to chat about the topic.
