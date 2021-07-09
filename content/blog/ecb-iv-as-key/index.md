---
title: CBC - Recovering the key when IV is the same as the key
date: "2021-06-27T12:35:00.284Z"
description: "It might seem like a good idea to reuse the key as the IV, but we will see in this post how this can be exploited."
---

In this post we will investigate the "Recover the key from CBC with IV=Key" exercise from [Cryptopals](https://cryptopals.com/sets/2/challenges/27). I highly recommend attempting the previous CBC exercises yourself as they do a great job ramping up your knowledge on the subject.

## Prerequisites

In order for this attack to be successful two things must be in place:

1. The encryption uses the `KEY` as the `IV`
2. The server raises an error when decryption fails and reflects the decoded message to the attacker

## Attack

Given the conditions above we can exploit this in the following way:

1. Make a plaintext with a length of at least 3 blocks
2. Encrypt the plaintext and get the resulting ciphertext
3. Modify the second block of the ciphertext to _contain only zeros_
4. Mofify the third block of the ciphertext to be _the same as the first block_
5. Decrypt the ciphertext and get the _invalid plaintext_ result
6. XOR the first and third blocks of the _invalid plaintext_
7. That's our key!

## Explanation

This seems magical at first, but let's recomember the operation that is performed by CBC during decryption:

![CBC Decryption by WhiteTimberwolf](../../assets/cbc_decryption.svg)

Deconstructing what needs to happen in order to decrypt our `first block`:

1. `result = AES_Decrypt(first_block_ciphertext, KEY)`
2. `result XOR KEY` (remember that we are using the KEY as the IV)

Deconstructing what needs to happen in order to decrypt our `third block`:

1. `result = AES_Decrypt(third_block_ciphertext, KEY)`
2. `result XOR second_block_ciphertext`

Let's `XOR` these operations together:

```
AES_Decrypt(first_block_ciphertext, KEY) XOR KEY
XOR
AES_Decrypt(third_block_ciphertext, KEY) XOR second_block_ciphertext
```

Given that our first ciphertext block contents **is the same** as our third ciphertext block (step 4 of attack) we know that the following operations will produce the same result:

- `AES_Decrypt(first_block_ciphertext, KEY)`
- `AES_Decrypt(third_block_ciphertext, KEY)`

When we XOR these two operations together the result will be **zero**. This leaves us with:

```
=> 0 XOR KEY XOR second_block_ciphertext
=> KEY XOR second_block_ciphertext
```

Remember that we made our second ciphertext block contain only zeroes (step 3 of attack), so:

```
=> KEY XOR 0
=> KEY
```

And that's the reason we can extract the `KEY` in this attack.

## Implementation based on Cryptopal requirements

```rb
class InvalidFormat < StandardError; end

KEY = 16.times.map { rand(0..255) }

def encode_cookie(input)
  prefix = 'comment1=cooking%20MCs;userdata='
  suffix = ';comment2=%20like%20a%20pound%20of%20bacon'
  plaintext = prefix + input.tr(';=', '') + suffix
  raise InvalidFormat.new(plaintext) unless plaintext.ascii_only?
  aes_cbc_encrypt(pkcs7_pad(plaintext.bytes, 16), KEY, KEY)
end

def decode_cookie(ciphertext)
  plaintext = pkcs7_unpad(
    aes_cbc_decrypt(ciphertext, KEY, KEY)
  ).pack('C*')

  raise InvalidFormat.new(plaintext) unless plaintext.ascii_only?
  config = plaintext.split(';').map { |kv| kv.split('=') }.to_h
  puts "Decoded data: #{config}"
  puts "Admin detected: #{config['admin'] == 'true'}"
end

def exploit_server(input)
  cookie = encode_cookie(input)
  # Step 3 of the attack
  16.times { |i| cookie[16 + i] = 0 }
  # Step 4 of the attack
  16.times { |i| cookie[32 + i] = cookie[i] }

  begin
    decode_cookie(cookie)
  rescue InvalidFormat => e
    puts "Invalid message!"
    e.message
  end
end

input = 'A' * (16 * 3)
# Step 5 of the attack
result = exploit_server(input)
blocks = result.bytes.each_slice(16).to_a

puts 'Original key:'
puts KEY.inspect

puts 'Key found:'
# Step 6 of the attack
puts xor_bytes(blocks[0], blocks[2]).inspect
```

See previous posts for the implementation of the following methods:

- pkcs7_pad
- pkcs7_unpad
- aes_cbc_encrypt
- aes_cbc_decrypt

And we have reached the end of our exercise! This should be our last post on `CBC`, on future posts we will start investigating a new block mode called `CTR`. Reach out to me on Twitter or by email if you have any questions or suggestions on how to improve this a future posts.
