---
title: ECB decryption (Simple)
date: "2021-06-27T12:35:00.284Z"
description: "Decrypting ECB a byte at a time"
---

In this post we will investigate the byte-at-a-time ECB decryption exercise from [Cryptopals](https://cryptopals.com/sets/2/challenges/12). I highly recommend attempting the previous exercises yourself as they do a great job ramping up your knowledge on the subject.

## Goal

The goal of this exercise is to figure out the **contents of an _unknown_ message that we know that will be encrypted under `ECB`**.

The only thing we control in this exercise is the fact that we can add a `prefix` to this unknown buffer before encryption.

To make this exercise more relatable we can think of a web server performing an operation like:

1. Get our username (we control that)
2. Concatenate it with something that is under the server control, let's say `;admin=false;`
3. After steps 1 and 2 the server will encrypt something like: `our_provided_name;admin=false;`
4. The server surfaces the encrypted value as a `cookie`

Our goal is discover that the server is appending `;admin=false;` to our provided input.

This could be translated in `Ruby` as:

```ruby
# Generating a random 16-bytes key to encrypt our unknown message with.
# We can think of this key as something the web server holds.
RANDOM_KEY = 16.times.map { rand(0..255) }

# The ;admin=false; in our example above
UNKNOWN_BUFFER = File.read('unknown_buffer').strip

def encryption_oracle(controlled_buffer)
  # Ignore this PKCS7_PAD function, all it does for our purposes in guarantee
  # that our message is a multiple of 16 bytes. We will understand the reason behind
  # this in the "ECB Encryption" section.
  padded_buffer = pkcs7_pad(
    controlled_buffer + UNKNOWN_BUFFER,
    16
  )

  # Our ECB encryption using our RANDOM KEY
  # We will implement this method below.
  aes_ecb_encrypt(padded_buffer, RANDOM_KEY)
end
```

## ECB Encryption

Let's see what ECB encryption actually is visually and talk about the reasons why encrypting things with ECB is not considered secure.

![ECB Encryption by WhiteTimberwolf](../../assets/ecb_encryption.svg)

According to the image above we have a `plaintext` (message) that we want to encrypt, and what the algorithm does is:

1. Split our plaintext in `blocks` of 8 or 16 bytes, we will be using 16 bytes for our example
2. Encrypt each of these blocks using a 16-byte `key` (the same size as our blocks)

This is considered insecure since _encrypting the same block will always yield the same ciphertext (encoded block)_, and due to this characteristic we can observe the following characteristics from observing _ciphertexts encrypted under the same key_:

1.  Detect if plaintexts are _equal_ or not
2.  Detect if plaintexts _share a common prefix_
3.  Detect if plaintexts _share common substrings_ (depends on block alignment)
4.  Detect _repetitive data_ in a plaintext

**What happens when a plaintext is not a multiple of 16 bytes?**

In this case we can use a padding algorithm, a commonly used one is called [pkcs7](<https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7>).

## Example in Ruby

Let's use `blocks` of `16 bytes` (128 bit encryption), meaning our message will be split into blocks of `16 bytes` each.

We will create two plaintexts that share a common prefix of 16 bytes (the size of a block). What we want to prove is that **the first block of each encrypted message will also be the same**.

```ruby
require 'openssl'

KEY = 'supersecretkey?!'
BLOCK_SIZE = 16

def aes_ecb_encrypt(buffer, key)
  raise 'Buffer must be composed of 16-byte chunks' unless (buffer.size % 16).zero?
  cipher = OpenSSL::Cipher.new('AES-128-ECB')
  cipher.encrypt
  cipher.key = key.pack('C*')
  cipher.padding = 0 # we don't want padding in our example
  result = cipher.update(buffer.pack('C*')) + cipher.final
  result.unpack('C*')
end

# The only difference between this method and the one above is the "cipher.decrypt" line.
def aes_ecb_decrypt(buffer, key)
  raise 'Buffer must be composed of 16-byte chunks' unless (buffer.size % 16).zero?
  cipher = OpenSSL::Cipher.new('AES-128-ECB')
  cipher.decrypt
  cipher.key = key.pack('C*')
  cipher.padding = 0 # we don't want padding in our example
  result = cipher.update(buffer.pack('C*')) + cipher.final
  result.unpack('C*')
end

# The first 16 bytes are the same for both plaintexts, which is: "This message has"
plaintext1 = 'This message has lots of content'
plaintext2 = 'This message has amazing content'

encrypted_plaintext1 = aes_ecb_encrypt(
  plaintext1.bytes,
  KEY.bytes
)

# Sanity test so we can be sure our encryption/decryption works
if aes_ecb_decrypt(encrypted_plaintext1, KEY.bytes)
  puts "Decrypting our encryption works!"
end

ciphertext1_first_block = aes_ecb_encrypt(
  plaintext1.bytes,
  KEY.bytes
).slice(0, BLOCK_SIZE)

ciphertext2_first_block = aes_ecb_encrypt(
  plaintext2.bytes,
  KEY.bytes
).slice(0, BLOCK_SIZE)

if ciphertext1_first_block == ciphertext2_first_block
  puts "Encrypting the same plaintext content yields the same ciphertext!"
end

# We can also see that the same plaintext encrypted twice will result in the same ciphertext
first_encryption = aes_ecb_encrypt(
  plaintext1.bytes,
  KEY.bytes
)
second_encryption = aes_ecb_encrypt(
  plaintext1.bytes,
  KEY.bytes
)

if first_encryption == second_encryption
  puts "The same message will always yield the same encrypted result in ECB."
end
```

## Byte-at-a-time ECB decryption

With the knowledge of the algorithm in place, how would we attempt to reverse engineer our _unknown message_ encrypted with ECB?

Let's recap what we know so far:

1. Our unknown message will be split into `blocks` of `16 bytes` and each of these blocks will be encrypted under an unknown `key`
2. We control the `prefix`, so we also control whatever our _initial blocks_ will be
   - Take a moment to truly understand this statement

It's time to work with a contrived example. :)

### Contrived Example

Assume that:

1. Our `block size` is `4 bytes`
2. Our buffer is `[0,1,2,3,4,5,6,7]` (the message that the server appends and we **do not know**)

We control our `prefix`, so let's add add 3 'A's (block size minus one) to our message. The final string that will be encrypted ends up being: <br />
`[A, A, A, 0, 1, 2, 3, 4, 5, 6, 7]`

Notice that our first block is `[A, A, A, 0]` (4 bytes) and we know the first three bytes (our prefix), but we do not know the _last byte of this block_.

We let the server encrypt this value and take note of it.

With the knowledge that the _same block encrypted under the same key produces the same ciphertext_ we can start our enumeration process. We want to feed to the server the same first block that it encrypted when we sent our three 'A's. To do that we need to send our three 'A's yet again plus the byte we want to enumerate.

- [A, A, A, 0], [A, A, A, 1], [A, A, A, 2] and so on.
  - We now store every attempt and compare it with the original encrypted block

By comparing the encrypted value of `[A, A, A, 0]` (original encryption) with our dictionary we find that the first byte is `0`, so it's time to find the `second unknown byte`. To do this we need to send two 'A's this time instead of three! This is the case since we already know one byte of the buffer, and we want to figure out the second unknown byte. Our output after sending two 'A's is: <br />
`[A, A, 0, 1, 2, 3, 4, 5, 6, 7]`

This means our first block is `[A, A, 0, 1]` and we again know the first three bytes, so we can enumerate only the last one.

- [A, A, 0, 0], [A, A, 0, 1], [A, A, 0, 2] and so on.
  - We now store every attempt and compare it with the original encrypted block

By comparing the encrypted value of `[A, A, 0, 1]` (original encryption) with our dictionary we find that the second byte is `1`.

We repeat the process always sending one less 'A' until we figure out the first full block of our unknown message, which is composed of the bytes <br/>
`[0, 1, 2, 3]`.

It's time to decode the second block, so let's send again 3 'A's, ending up with: <br/>
`[A, A, A, 0, 1, 2, 3, 4, 5, 6, 7]`.

We are interested in our `second block`, which is `[1, 2, 3, 4]` and we know the first three bytes! So we can start our enumeration steps all over again.

We just need to repeat _this same process_ until we have the full string.

### Formal algorithm

1. Craft an input block that is exactly `1 byte short` (for instance, if the block size is 8 bytes, make "AAAAAAA")
2. Make a dictionary of every possible last byte by feeding different strings to the encryption function; for instance, "AAAAAAAA", "AAAAAAAB", "AAAAAAAC", remembering the first block of each invocation.
3. Match the output of the one-byte-short input to one of the entries in your dictionary. You've now discovered the first byte of unknown-string.
   Repeat for the next byte.

## Implementation

```ruby
KEY_SIZE = 16
RANDOM_KEY = KEY_SIZE.times.map { rand(0..255) }
UNKNOWN_BUFFER = base64_decode(File.read('12.txt').strip)
BYTE = 'A'.ord

def decrypt_byte(target, controlled_prefix, current_block)
  (0..255).each do |byte|
    # Our encryption function from the beginning of our post
    encryption = encryption_oracle(controlled_prefix + [byte])
    return byte if encryption.slice(current_block * KEY_SIZE, KEY_SIZE) == target
  end

  raise "This shouldn't happen!"
end

def decrypt_aes_ecb
  known = []

  UNKNOWN_BUFFER.size.times do
    current_block = known.size / KEY_SIZE
    prefix_size = (KEY_SIZE - known.size - 1) % KEY_SIZE
    prefix = Array.new(prefix_size, BYTE)
    controlled_encryption = encryption_oracle(prefix)

    known << decrypt_byte(
      controlled_encryption.slice(current_block * KEY_SIZE, KEY_SIZE),
      prefix + known,
      current_block
    )
  end

  known
end

puts "Message found!\n\n#{decrypt_aes_ecb.pack('C*')}"
```

And we have reached the end of our exercise! Congratulations, take a moment to be proud of what you have achieved and I hope you are looking forward to the next posts as much as I am. :)
