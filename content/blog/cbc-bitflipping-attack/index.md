---
title: CBC bit-flipping attack
date: "2021-07-18T09:35:00.284Z"
description: "Let's understand and implement the CBC bit-flipping attack."
---

This post is based on the `CBC bit-flipping attack` exercise from [Cryptopals](https://cryptopals.com/sets/2/challenges/16). I highly recommend attempting the previous exercises yourself as they do a great job ramping up your knowledge on the subject.

Before we can start tackling this problem it's worth revisiting how `cipher block chaining` (CBC) works as we will need to know the algorithm in order to perform the bit-flipping attack.

## CBC Encryption

In a nutshell `CBC` encryption works in the following order:

1. Split the plaintext into blocks of 16 bytes (this number can change, but the next steps are the same)
2. For each plaintext block:
   - XOR the block with its _previous ciphertext block_
   - Encrypt the result with `AES` to produce the ciphertext. This ciphertext will be XORed with the next plaintext block.

**Since we always use the previous ciphertext to generate a block, how do we generate the first block?**

For the first block we use something called an `Initialization Vector` (IV), which is nothing more than a random array of bytes that has the same length as our block.

**Details**

For `CBC` to work the plaintext must be a multiple of the `block size`, so we usually use a padding algorithm like `PKCS7` to pad our plaintext.

Let's see the visual representation of the algorithm:

![CBC Encryption by WhiteTimberwolf](../../assets/cbc_encryption.svg)

## CBC Decryption

The decryption process consists of us doing the inverse of what we did for the encryption process, so:

1. Split the full ciphertext into blocks of 16 bytes
2. For each ciphertext block:
   - Decrypt the block with `AES`
   - XOR the decrypted block with the _previous ciphertext block_.

In order to decrypt our first block we need to rely yet again on our `initialization vector` (IV).

Let's see the visual representation of the algorithm:

![CBC Decryption by WhiteTimberwolf](../../assets/cbc_decryption.svg)

## CBC Ruby Implementation

```rb
def xor_bytes(bytes1, bytes2)
  if bytes1.size != bytes2.size
    raise 'Array of bytes should have same length'
  end

  bytes1.zip(bytes2).map { |a, b| a ^ b }
end

def aes_cbc_encrypt(plaintext, key, iv)
  blocks = plaintext.each_slice(key.size)
  previous_ciphertext_block = iv

  blocks.flat_map do |block|
    previous_ciphertext_block = aes_ecb_encrypt(
      xor_bytes(previous_ciphertext_block, block),
      key
    )

    previous_ciphertext_block
  end
end

  def aes_cbc_decrypt(ciphertext, key, iv)
  blocks = ciphertext.each_slice(key.size)
  previous_ciphertext = iv

  blocks.flat_map do |block|
    decrypted = xor_bytes(
      aes_ecb_decrypt(block, key),
      previous_ciphertext
    )

    previous_ciphertext = block
    decrypted
  end
end
```

_See [ECB decryption post](/ecb-decryption-simple) for the implementation of the `aes_ecb_encrypt` and `aes_ecb_decrypt_methods` methods._

## Bitflipping Attack

Now that we understand how `CBC` works we can talk about this particular attack which relies on the fact that in `CBC mode`, a 1-bit error in a ciphertext block:

1. Completely scrambles the block the error occurs in
2. Produces the identical 1-bit error in the next ciphertext block.

The first point is the easier one to reason about. Since we have encrypted our block with `ECB`, messing up with the ciphertext bits will in fact change the contents of our plaintext once it is decrypted by `ECB` in a random manner.

The second point requires more attention though and for it to make sense I feel it is helpful to reach out for an example.

**Our goal with the following exercise is to transform our input**

- From: `name=cbc attack;admin<true:id=11`
- To: `name=cbc attack;admin=true;id=11`

**A few important things to note:**

Our plaintext is already block aligned since the block size for this exercise is `16 bytes` and our plaintext has `32 bytes`.

First block: `name=cbc attack;` <br/>
Second block: `admin<true:id=11`

Transforming `admin<true:id=11` into `admin=true;id=11` will require us to transform:

- `<` (ASCII 60) into `=` (ASCII 61)
- `:` (ASCII 58) into `;` (ASCII 59)

Let's lay the ground for our problem in Ruby:

```rb
BLOCK_SIZE = 16
KEY = BLOCK_SIZE.times.map { rand(0..255) }
IV = BLOCK_SIZE.times.map { rand(0..255) }
PLAINTEXT = 'name=cbc attack;admin<true:id=11'.bytes

# Our encryption method defined earlier in this post
ciphertext = aes_cbc_encrypt(PLAINTEXT, KEY, IV)

ciphertext.each_slice(BLOCK_SIZE) do |block|
  puts block.inspect
end
```

This program outputs the following:

```
First block:
[135, 247, 220, 139, 108, 224, 161, 24, 21, 43, 213, 93, 49, 101, 91, 55]

Second block:
[161, 167, 98, 71, 30, 176, 244, 73, 72, 228, 148, 176, 198, 21, 39, 68]
```

**Here's what we want to prove again:**

> A 1-bit error in a ciphertext block:
>
> 1. Completely scrambles the block the error occurs in
> 2. Produces the identical 1-bit error in the next ciphertext block.

**Let's recap what we need to do in order to decrypt blocks using `CBC`:**

> - Decrypt the current ciphertext block with AES-ECB
> - XOR that decrypted_value with the previous ciphertext block

**With that in mind let's reverse engineer what we need to do to achieve our goal:**

First we have to figure out the value of the `ECB decryption` for the bytes we are interested in:

1. `ecb_decryption(176) XOR 224 = 60`
2. `ecb_decryption(148) XOR 213 = 58`

Let's dive into what these numbers represent.

**What are these numbers?**

1. `176` is the value of the `6th byte` (<) in our second block and `224` is the 6th byte of our first block, while `60` represents the `<` character in ASCII.
2. `148` is the value of the `11th byte` (:) in our second block and `213` is the 11th byte of our first block, while `58` represents the `:` character in ASCII.

Let's compute our `XOR` equation for our `first point`:

=> `ecb_decryption(176) XOR 224 = 60` <br/>
=> `ecb_decryption(176) = 60 XOR 224` <br/>
=> `ecb_decryption(176) = 220`

Now we need to convert our `<` into an `=`, which is represented as `61` in ASCII: <br/>
`220 XOR 61 = ?` <br />
`225`

Going to our `second point`:

=> `ecb_decryption(148) XOR 213 = 58` <br/>
=> `ecb_decryption(148) = 58 XOR 213` <br/>
=> `ecb_decryption(148) = 239`

Now we need to convert our `:` into an `;`, which is represented as `59` in ASCII: <br/>
`239 XOR 59 = ?` <br />
`212`

So the changes in our first block needs to be:

`6th byte` goes from `224` to `225` <br/>
`11th byte` goes from `213` to `212`

And if we look closely that's exactly a `1-bit XOR`!

=> `224 XOR 1 = 225` <br/>
=> `213 XOR 1 = 212`

We are ready for our full code:

```rb
BLOCK_SIZE = 16
KEY = BLOCK_SIZE.times.map { rand(0..255) }
IV = BLOCK_SIZE.times.map { rand(0..255) }
PLAINTEXT = 'name=cbc attack;admin<true:id=11'.bytes

ciphertext = aes_cbc_encrypt(PLAINTEXT, KEY, IV)
ciphertext[5] ^= 1  # 6th byte of our first block
ciphertext[10] ^= 1 # 11th byte of our first block

puts aes_cbc_decrypt(ciphertext, KEY, IV).pack('C*')
```

And the output of this is: `�;5��H��G�\Ladmin=true;id=11`

Which is exactly what we expected. The first block became scrambled while the second one carried the changes we were looking for!

And we have reached the end of our exercise! Congratulations, take a moment to be proud of what you have achieved and I hope you are looking forward to the next posts as much as I am. :)
