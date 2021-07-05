---
title: CTR mode introduction
date: "2021-08-25T12:15:00.284Z"
description: "In this post we will investigate how encrypting and decrypting in CTR mode works."
---

So far we have learned about [ECB](/ecb-decryption-simple) and [CBC](/cbc-bitflipping-attack), now it's time to explore the `Counter (CTR) mode`. Let's start with a definition from Wikipedia:

> Counter mode turns a block cipher (like ECB or CBC) into a stream cipher. It generates the next keystream block by encrypting successive values of a "counter". The counter can be any function which produces a sequence which is guaranteed not to repeat for a long time, although an actual increment-by-one counter is the simplest and most popular.

There are a few characteristics of this mode that are worth mentioning:

1. It does not require padding
2. Decryption is identical to encryption
3. Blocks can be encrypted in parallel
4. Allows for random access during decryption

With that said, let's see how encryption works for this mode.

## Encryption

![CTR Encryption by Gwenda](../../assets/ctr_encryption.svg)

As we can see from the image above we have four components in our system.

1. Nonce
   - Usually a random value
2. Counter
   - Usually an incremental counter as seen in the image
3. Key
   - The key to encrypt `Nonce + Counter` under `ECB`
4. Plaintext
   - Our message that will be split in blocks of `16 bytes` each.

The `Nonce` plus `Counter` can be combined in any way in order to generate a value that has the same size of our block, which is `16 bytes`.

Let's create an example and encrypt it step by step under CTR.

### Example

**Nonce**: `[33, 112, 111, 116, 97, 116, 111, 33]`

**Counter**: Starts at zero and will occupy `8 bytes` in our example <br/>

This means our first iteration will run with counter: <br/>
`[0, 0, 0, 0, 0, 0, 0, 0]`

The second iteration will run with counter: <br/>
`[1, 0, 0, 0, 0, 0, 0, 0]`

The third iteration will run with counter: <br/>
`[2, 0, 0, 0, 0, 0, 0, 0]`

And so on and so forth.

**Key**: `[76, 80, 122, 102, 50, 110, 51, 198, 232, 120, 106, 233, 189, 55, 5, 47]` (16 bytes)

**Plaintext**: `[115, 117, 112, 101, 114, 115, 101, 99, 114, 101, 116, 109, 101, 115, 115, 97, 103, 101, 100, 111, 110, 116, 112, 101, 101, 107, 112, 108, 101, 97, 115, 101, 33]` (33 bytes)

Notice that our plaintext has a size of `33 bytes`, which means it will be split into `3 blocks`.

**First block encryption**

The first step is to generate the `Nonce + Counter`. In this example we will concatenate both arrays and end up with: <br/>
`[33, 112, 111, 116, 97, 116, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0]`

Now we encrypt this value under `ECB` using our `key` and get back: <br/>
`[157, 136, 111, 203, 58, 132, 197, 84, 85, 135, 63, 235, 158, 224, 196, 100]`

The next step is to `XOR` this value with our first block from the plaintext:

```
[157, 136, 111, 203, 58, 132, 197, 84, 85, 135, 63, 235, 158, 224, 196, 100]
XOR with FIRST BLOCK
[115, 117, 112, 101, 114, 115, 101, 99, 114, 101, 116, 109, 101, 115, 115, 97]
```

And we end up with: <br/>
`[238, 253, 31, 174, 72, 247, 160, 55, 39, 226, 75, 134, 251, 147, 183, 5]`

**Second block encryption**

The first step is to generate the `Nonce + Counter`: <br/>
`[33, 112, 111, 116, 97, 116, 111, 33, 1, 0, 0, 0, 0, 0, 0, 0]`

Now we encrypt this value under `ECB` using our `key` and get: <br/>
`[165, 24, 130, 65, 106, 217, 109, 50, 112, 214, 155, 118, 169, 217, 198, 65]`

Followed by `XOR`ing this value with our second block from the plaintext:

```
[165, 24, 130, 65, 106, 217, 109, 50, 112, 214, 155, 118, 169, 217, 198, 65]
XOR with SECOND BLOCK
[103, 101, 100, 111, 110, 116, 112, 101, 101, 107, 112, 108, 101, 97, 115, 101]
```

And we end up with: <br/>
`[194, 125, 230, 46, 4, 173, 29, 87, 21, 189, 235, 26, 204, 184, 181, 36]`

**Third block encryption**

This block is interesting since we only have a single byte remaining from our plaintext, so let's see how the algorithm encrypts it:

The first step is to generate the `Nonce + Counter`: <br/>
`[33, 112, 111, 116, 97, 116, 111, 33, 2, 0, 0, 0, 0, 0, 0, 0]`

Now we encrypt this value under `ECB` using our `key` and get: <br/>
`[84, 38, 123, 152, 20, 104, 97, 111, 59, 94, 140, 85, 214, 90, 181, 199]`

Followed by `XOR`ing this value with our third block from the plaintext:

```
[84, 38, 123, 152, 20, 104, 97, 111, 59, 94, 140, 85, 214, 90, 181, 199]
XOR with THIRD BLOCK
[33]
```

These are clearly different in size, so how can we `XOR` these? In this case the solution adopted by the algorithm is simple, we only XOR
the amount of bytes that our plaintext block has remaining, which is a single byte in our example! So:

```
[84]
XOR
[33]
```

And we end up with: `[117]`

**Final encryption**

After concatenating all of our results we end up with our `ciphertext`:<br/>
`[238, 253, 31, 174, 72, 247, 160, 55, 39, 226, 75, 134, 251, 147, 183, 5, 194, 125, 230, 46, 4, 173, 29, 87, 21, 189, 235, 26, 204, 184, 181, 36, 117]`

Let's solve this programatically and see if we end up with the same value!

```rb
require 'openssl'

NONCE = [33, 112, 111, 116, 97, 116, 111, 33]
KEY = [76, 80, 122, 102, 50, 110, 51, 198, 232, 120, 106, 233, 189, 55, 5, 47]
PLAINTEXT = [115, 117, 112, 101, 114, 115, 101, 99, 114, 101, 116, 109, 101, 115, 115, 97, 103, 101, 100, 111, 110, 116, 112, 101, 101, 107, 112, 108, 101, 97, 115, 101, 33]

def aes_ecb_encrypt(plaintext, key)
  raise 'Buffer must be composed of 16-byte chunks' unless (plaintext.size % 16).zero?
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
    block.zip(intermediate).map { |a, b| a ^ b }
  end
end

puts aes_ctr_encrypt(PLAINTEXT, KEY, NONCE).inspect
```
<br />
Since this provides the same result as our manual encryption we can move to the decryption.

## Decryption

![CTR Decryption by Gwenda](../../assets/ctr_decryption.svg)

The cool thing about this algorithm is that the decryption is **exactly the same as the encryption**, we only need to provide the ciphertext to our algorithm instead of the plaintext.

Let's get our ciphertext from the previous example and programatically decrypt it using the `exact same code`.

Remember, our `ciphertext` was: <br/>
`[238, 253, 31, 174, 72, 247, 160, 55, 39, 226, 75, 134, 251, 147, 183, 5, 194, 125, 230, 46, 4, 173, 29, 87, 21, 189, 235, 26, 204, 184, 181, 36, 117]`

```rb
require 'openssl'

NONCE = [33, 112, 111, 116, 97, 116, 111, 33]
KEY = [76, 80, 122, 102, 50, 110, 51, 198, 232, 120, 106, 233, 189, 55, 5, 47]
PLAINTEXT = [115, 117, 112, 101, 114, 115, 101, 99, 114, 101, 116, 109, 101, 115, 115, 97, 103, 101, 100, 111, 110, 116, 112, 101, 101, 107, 112, 108, 101, 97, 115, 101, 33]

# This is the value we got from our encryption
CIPHERTEXT = [238, 253, 31, 174, 72, 247, 160, 55, 39, 226, 75, 134, 251, 147, 183, 5, 194, 125, 230, 46, 4, 173, 29, 87, 21, 189, 235, 26, 204, 184, 181, 36, 117]

def aes_ecb_encrypt(plaintext, key)
  raise 'Buffer must be composed of 16-byte chunks' unless (plaintext.size % 16).zero?
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
    block.zip(intermediate).map { |a, b| a ^ b }
  end
end

# Notice that we are passing the CIPHERTEXT
decryption =  aes_ctr_encrypt(CIPHERTEXT, KEY, NONCE)
puts decryption == PLAINTEXT # true
```
<br/>
And this is all the information we need to understand yet another block cipher mode, congratulations!
<br/><br/>
In future posts we will explore attacks involving this mode and how they can be prevented. Reach out to me via email or Twitter if you have suggestions, questions or just want to chat about the topic.
