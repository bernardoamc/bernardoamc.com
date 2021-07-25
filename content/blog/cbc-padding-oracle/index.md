---
title: CBC Padding Oracle
date: "2021-07-25T12:43:00.284Z"
description: "Exploiting CBC Padding Oracle"
---

In this post we will investigate the byte-at-a-time ECB decryption exercise from [Cryptopals](https://cryptopals.com/sets/3/challenges/17). It's helpful to read the problem statement before reading this blog post and I highly recommend attempting the previous exercises yourself as they do a great job ramping up your knowledge on the subject.We also have a [previous post](/cbc-bitflipping-attack) explaining how `CBC` works.

This attack relies on a `padding oracle`, which is something that is able to tell us whether the ciphertext we provide for decryption has a valid `padding` or not after decryption. In our exercise this will be in the form of a method that returns `true` or `false` based on a valid padding or not. Let's see this in `Ruby`:

```rb
def padding_oracle(ciphertext, key, iv)
  plaintext = aes_cbc_decrypt(ciphertext, key, iv)
  valid_padding?(plaintext)
end

# Based on https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7
def valid_padding?(plaintext)
  padding_size = plaintext.last
  return false unless padding_size > 0 && padding_size < 256

  padding = plaintext.slice(
    -padding_size,
    padding_size
  )

  padding.all? { |b| b == padding_size }
end
```

To make things more relatable we can think of this `padding_oracle` as our `server` validating whether a cookie passed to it is valid or not.

## Recap on CBC decryption

![CBC Decryption by WhiteTimberwolf](../../assets/cbc_decryption.svg)

In order to obtain the `plaintext block` from a `ciphertext block` the algorithm first decrypts the `ciphertext block` using `ECB` with the encryption `key` (labeled "block cipher decryption" in our image), followed by a XOR with the previous ciphertext block. For the first block we use the `inialization vector` since we don't have a previous ciphertext block.

See our [previous post](/cbc-bitflipping-attack) for a more in-depth explanation of how `CBC` works.

We have access to the `previous ciphertext block` or the `initialization vector`, but we **do not have access to the ECB decryption**. Luckily for us this attack allows us to derive the value of the `AES decryption` (labeled "block cipher decryption" in our image), which makes us able to compute the `plaintext` out of an `encrypted block`.

It's worth reiterating, what this attack allows us to do is:

> Derive the value of the `AES decryption` (labeled "block cipher decryption" in our image).

## Exploitation

Even though we don't control the `AES decryption` value, we control the value that will be XORed against it. Let's define this operation:

`AES_DEC(ciphertext_block) XOR user_controlled_value`

Normally this "user controlled value" would be the previous ciphertext block or the initialization vector (IV), but nothing prevents us from sending whatever we want, right? :) The insight is that:

> By making modifications to the previous ciphertext block (or IV for the first block), we can predictably modify the plaintext block.

What we want to achieve with this "user controlled value" is to generate on every iteration a plaintext that has a **valid padding**. Recall that we are using `PKCS7` for this exercise, so a valid padding consists of the `last n bytes` of our plaintext all having the same value `n`. So the following endings for our plaintext are all considered valid:

```
01
02 02
03 03 03
...
16 16 16 .. 16 16
```

What we need to do is:

1. Create what we will call a `Zeroing IV`, which for now is an array containing zeros with the size of a `block`
   - By the end of the algorithm the `Zeroing IV` will be an array that once XORed with `AES_DEC(ciphertext_block)` **returns zero**
2. Compute an IV that once XORed provides us with a plaintext that has a valid padding of `1`
3. Get the last byte from that IV and XOR it with `1`, storing the result in the last byte of our `Zeroing IV`

Once this is done we will:

1. Derive a new IV that sets thet final byte to `2` and try to compute the penultimate byte to `2` as well.
2. Get the penultimate byte from that IV and XOR it with `2` to generate the penultimate byte of the `Zeroing IV`

Keep doing this until we can find all `16` bytes of a block.

If you are used to the `XOR` operation you will realize right away that the only way for `AES_DEC(ciphertext_block) XOR Zeroing IV` to output zero is if they are **equal**! This means that we have just computed the value of `AES_DEC(ciphertext_block)`, which was the only thing we didn't know.

To output our plaintext message all we need to do now is perform the operation: `Zeroing IV XOR Our original IV`.

## Visual example

Let's see an example with the first two iterations of our attack to make things a bit more concrete.

Assume `AES_DEC(ciphertext_block)` has a value of: <br />
`[99, 111, 110, 103, 114, 97, 116, 117, 108, 97, 116, 105, 111, 110, 115, 33]`

Our initial `Zeroing IV` is of course composed of all zeros: <br/>
`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`

**Iteration 1**

We want to make the operation `AES_DEC(ciphertext_block) XOR Zeroing IV` return an array with the final byte set to `1` in order for our `padding_oracle` method to return true. To achieve that we first need to find a value that makes `33 XOR <something> = 1`:

`33 XOR 0 = 33` is a valid padding? NO<br />
`33 XOR 1 = 32` is a valid padding? NO<br />
`33 XOR 2 = 35` is a valid padding? NO<br />
.. <br />
`33 XOR 32 = 1` is a valid padding? YES

So right now our `Zeroing IV` is: <br />
`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32]`

This means that `AES_DEC(ciphertext_block) XOR Zeroing IV` will output something like: <br/>
`[99, 111, 110, 103, 114, 97, 116, 117, 108, 97, 116, 105, 111, 110, 115, 1]`

This is indeed a block with a valid padding!

Time to XOR this last value with `1` so we can get our true zero value. <br />
`32 XOR 1 = 33`

So right now our `Zeroing IV` is: <br />
`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33]`

Notice how 33 is the same value of our imaginary `AES_DEC(ciphertext_block)` last byte!

**Iteration 2**

Now we need to make the operation `AES_DEC(ciphertext_block) XOR Zeroing IV` return an array with the final and penultimate bytes set to `2` in order for our `padding_oracle` method to return true. In order to do that we need to:

1. Make `33 XOR <something> = 2`
2. Make `115 XOR <something> = 2`

Since we already know due to our first iteration that `AES_DEC(ciphertext_block)` last byte is `33` we can just compute `33 ^ 2` which is equal `35`

Now we need to make `115 XOR something = 2`, so let's find the appropriate byte:

`115 XOR 0 = 115` is a valid padding? NO<br />
`115 XOR 1 = 114` is a valid padding? NO<br />
`115 XOR 2 = 113` is a valid padding? NO<br />
.. <br />
`115 XOR 113 = 2` is a valid padding? YES

So right now our `NEW Zeroing IV` is: <br />
`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 113, 35]`

This means that `AES_DEC(ciphertext_block) XOR NEW Zeroing IV` will output something like: <br/>
`[99, 111, 110, 103, 114, 97, 116, 117, 108, 97, 116, 105, 111, 110, 2, 2]`

Which is again a block with a valid padding!

Time to XOR this penultimate value with `2` so we can get our true zero value. <br />
`113 XOR 2 = 115`

So right now our "final" `Zeroing IV` is: <br />
`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 115, 33]`

Notice how 115 is the same value of our imaginary `AES_DEC(ciphertext_block)` penultimate byte!

The next iteration will make the last three bytes equal to `3` and we are going to find yet another byte, and so on and so forth until we decrypt an entire block, so eventually our `Zeroing IV` will become the same as our `AES_DEC(ciphertext_block)`:

`[99, 111, 110, 103, 114, 97, 116, 117, 108, 97, 116, 105, 111, 110, 115, 33]`

## Implementation

This is one of those algorithms that are harder to explain than to implement, so let's attempt to do it.

```rb
require 'openssl'

KEY = 16.times.map { rand(0..255) }
IV = 16.times.map { rand(0..255) }
BLOCK_SIZE = 16
BYTE_RANGE =0..256

# Don't look! ;)
PLAINTEXT = [99, 111, 110, 103, 114, 97, 116, 117, 108, 97, 116, 105, 111, 110, 115, 33, 32, 119, 101, 32, 100, 105, 100, 32, 105, 116, 33]

# See our previous post on CBC Bitflipping Attacks to understand CBC better
def aes_cbc_encrypt(plaintext)
  cipher = OpenSSL::Cipher::AES.new(128, :CBC)
  cipher.encrypt
  cipher.key = KEY.pack('C*')
  cipher.iv = IV.pack('C*')
  cipher.padding = 0
  cipher.update(plaintext.pack('C*')) + cipher.final
end

def aes_cbc_decrypt(ciphertext, iv)
  cipher = OpenSSL::Cipher::AES.new(128, :CBC)
  cipher.decrypt
  cipher.key = KEY.pack('C*')
  cipher.iv = iv.pack('C*')
  cipher.padding = 0
  cipher.update(ciphertext.pack('C*')) + cipher.final
end

# See https://tools.ietf.org/html/rfc2315#section-10.3
def pkcs7_pad(bytes, block_size)
  raise 'Invalid block size' if block_size >= 256
  padding_len = block_size - (bytes.size % block_size)
  padding = Array.new(padding_len, padding_len)
  bytes + padding
end

#############################################################
# Our boilerplate is done, time to implement our algorithm! #
#############################################################

def encrypt_credentials
  padded_buffer = pkcs7_pad(PLAINTEXT, BLOCK_SIZE)
  ciphertext = aes_cbc_encrypt(padded_buffer).unpack('C*')

  [IV, ciphertext]
end

def padding_oracle(ciphertext, iv)
  plaintext = aes_cbc_decrypt(ciphertext, iv).unpack('C*')
  valid_padding?(plaintext)
end

# Based on https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7
def valid_padding?(plaintext)
  padding_size = plaintext.last
  return false unless padding_size > 0 && padding_size <= BLOCK_SIZE

  padding = plaintext.slice(
    -padding_size,
    padding_size
  )

  padding.all? { |b| b == padding_size }
end

def decrypt_byte(block, zero_iv, known)
  iv = Array.new(BLOCK_SIZE, 0)
  padding_size = known + 1
  next_byte_pos = BLOCK_SIZE - known - 1

  (1..known).each do |index|
    iv[-index] = zero_iv[-index] ^ padding_size
  end

  BYTE_RANGE.each do |candidate|
    iv[next_byte_pos] = candidate
    return candidate if padding_oracle(block, iv)
  end

  raise 'Candidate not found'
end

def decrypt_block(block, previous_block)
  zero_iv = Array.new(BLOCK_SIZE, 0)

  BLOCK_SIZE.times.each do |known|
    byte = decrypt_byte(block, zero_iv, known)
    zero_iv[BLOCK_SIZE - known - 1] = byte ^ (known + 1)
  end

  zero_iv.zip(previous_block).map { |a, b| a ^ b }
end

def decrypt(ciphertext, iv)
  blocks_amount = ciphertext.size / BLOCK_SIZE
  previous_block = iv

  (0...blocks_amount).flat_map do |block_index|
    block = ciphertext.slice(
      block_index * BLOCK_SIZE,
      BLOCK_SIZE
    )

    decrypted_block = decrypt_block(block, previous_block)
    previous_block = block

    decrypted_block
  end
end

iv, ciphertext = encrypt_credentials
puts decrypt(ciphertext, iv).pack('C*')
```

If we run the program above we will receive our plaintext as the output, how cool is that?! This is probably one of the problems that I have the most fun with since it uses most of the knowledge we have built upon previous exercises.

If you made it this far, congratulations! We are almost done with `CBC` attacks (I promise!), and we will start investigating `CTR mode`. As always, if anything is confusing or could be improved please reach out to me on Twitter or by email and I will be happy to chat about it!
