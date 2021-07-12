---
title: ECB Cut and Paste Attack
date: "2021-07-11T21:15:00.284Z"
description: "Let's exploit ECB yet again, this time through the cut and paste attack."
---

In this post we will investigate the ECB cut and paste attack exercise from [Cryptopals](https://cryptopals.com/sets/2/challenges/13). I highly recommend attempting the previous exercises yourself as they do a great job ramping up your knowledge on the subject.

Let's remember a key characteristic of ECB, which is:

> Encrypting the same plaintext under the same key will always yield the same ciphertext

This characteristic will be the key to solving our exercise.

## Challenge

The goal of this exercise is to send to our server an input that once decrypted elevates our privileges to `role=admin`.

To make this exercise more relatable we can think of a web server performing an operation like:

1. Read the user's email
2. Generates an output like: `email=foo@bar.com&uid=10&role=user`
3. The server encrypts the value from the previous step
4. The server surfaces the encrypted value as a `cookie`
5. Once the user comes back to the site the server will read this cookie's value and identify our user

Let's see the code:

```ruby
# The key used by the web server to encrypt and decrypt values
KEY = 16.times.map { rand(0..255) }

# Our helper method to encode a hash as a query string
# Outputs something like: `email=foo@bar.com&uid=10&role=user`
def encode_query_string(hash)
  hash.map { |k, v| "#{k}=#{v}" }.join('&')
end

# Our helper method to transform a query string into a Hash
def decode_query_string(input)
  input.split('&').map { |kv| kv.split('=') }.to_h
end

# Our helper method to pad our input with PKCS7 and encrypt
# it with ECB.
#
# See the post "Discovering ECB block size" for more details
# on PKCS7.
def encrypt_profile(input)
  aes_ecb_encrypt(pkcs7_pad(input, 16), KEY)
end

# Our helper method to decrypt a string with ECB, remove
# its PKCS7 padding and calling the query string decoder.
def decrypt_profile(input)
  decode_query_string(
    pkcs7_unpad(aes_ecb_decrypt(input, KEY)).pack('C*')
  )
end

# The method that:
# 1. Receives the user's email
# 2. Strips dangerous characters like "&" and "="
# 3. Generates a hash representing our session
# 3. Calls our encode_query_string method with the session
def profile_for(email)
  encode_query_string({
    'email' => email.tr('&=', ''),
    'uid'  => 10,
    'role'  => 'user'
  })
end
```

Let's see the code in action:

```rb
input = "bernardo.amc@gmail.com"
ciphertext = encrypt_profile(profile_for(input).bytes)
puts ciphertext.inspect
# => [101, 60, 198, 183, 84, 111, 86, 117, 34, 98, 147, 118, 111, 130, 197, 153, 251, 158, 167, 73, 230, 124, 163, 111, 170, 87, 166, 18, 76, 188, 240, 247, 65, 25, 192, 127, 154, 7, 138, 219, 54, 209, 69, 244, 112, 148, 35, 17]

profile = decrypt_profile(ciphertext)
puts profile.inspect
# => {"email"=>"bernardo.amc@gmail.com", "uid"=>"10", "role"=>"user"}
```

Nothing fancy, we end up with a Hash with keys `email`, `uid` and `role` as expected.

### Thought process

A few important things to keep in mind before we start:

1. We know that the server encodes a value like the following:
   - `email=our@email.com&uid=10&role=user`
2. We know the block size, which is `16`
3. We know our string is padded with PKCS7 before encryption

I didn't know anything about this attack before attempting to solve it, but the name of the exercise gives us a hint at how to solve our problem: _Cut and Paste Attack_

Maybe it is telling us that we need to _cut_ blocks and _paste_ them in a different order?

### Plan of Attack

My plan of attack to solve this exercise was to figure out an email length that once encrypted will put the `role=` and `user` into _different blocks_, this way I would be able to maybe cut another block and replace it with the one that has the `user` value. Let's see how we can do that:

1. We know that `email=` length is `6`, so to complete the `first block` we need `10` more characters.
2. We know that `&uid=10&role=` is `13 `characters, so we need `3` more characters to complete another block.

So if we send an email that is composed of `13` characters we end up with the following blocks:

```
Block 0: email=AAAAAAAAAA
Block 1: AAA&uid=10&role=
Block 2: user
```

The issue with this scenario is that there's no `block` we can cut and paste in order to transform our `role` into `admin`.

My next attempt was to simply write `16` more characters to create yet another `block` in-between the `email` and `role` blocks, something like:

```
Block 0: email=AAAAAAAAAA
Block 1: AAAAAAAAAAAAAAAA
Block 2: AAA&uid=10&role=
Block 3: user
```

This is much better! If we manage to make `Block 1` represent "admin", and we cut and paste it after the `role` block we can become admin:

```
Block 0: email=AAAAAAAAAA
Block 2: AAA&uid=10&role=
Block 1: AAAAAAAAAAAAAAAA
```

We know that `Block 1` should yield `admin` in order to end up with `role=admin`, but how do we send only `admin` and _nothing else_?

1. `admin` is 5 bytes long
2. What do we do with the rest `11` bytes that cannot be used?

That's when I remembered that we are _padding_ our input with [PKCS7](/ecb-discover-block-size), so we can likely exploit this by _pretending_ our first block was padded.

If PKCS7 were to pad our first block we would end up with: `admin\v\v\v\v\v\v\v\v\v\v\v`. Don't be confused by the `\v` character, it is just the visual representation of `11` in [ASCII](http://www.asciitable.com/), which is the _vertical tab_.

Why `11`? Because it is the number of bytes we need to `pad` our block with so it ends up with `16` bytes.

Let's recap what we want to achieve:

1. Send `10` characters in order for our first block to be `email=<our_10_characters>`
2. Send `admin\v\v\v\v\v\v\v\v\v\v\v` so we can cut and paste this block
3. Send `3` more characters so we have `<our_3_characters>&uid=10&role=`

Combining all of the above we end up with:

```
Block 0: email=AAAAAAAAAA
Block 1: admin\v\v\v\v\v\v\v\v\v\v\v
Block 2: AAA&uid=10&role=
Block 3: user
```

After after cutting our `Block 1` and pasting it on top of `Block 3`:

```
Block 0: email=AAAAAAAAAA
Block 2: AAA&uid=10&role=
Block 1: admin\v\v\v\v\v\v\v\v\v\v\v
```

Let's see this in Ruby:

```rb
input = "AAAAAAAAAAadmin\v\v\v\v\v\v\v\v\v\v\vAAA"
ciphertext = encrypt_profile(profile_for(input).bytes)

block0 = ciphertext.slice(0, 16)
block1 = ciphertext.slice(16, 16)
block2 = ciphertext.slice(32, 16)
ciphertext = block0 + block2 + block1

profile = decrypt_profile(ciphertext)

puts profile
# => {"email"=>"AAAAAAAAAAAAA", "uid"=>"10", "role"=>"admin"}
```

And we have reached the end of our exercise! Congratulations, take a moment to be proud of what you have achieved and I hope you are looking forward to the next posts as much as I am. :)
