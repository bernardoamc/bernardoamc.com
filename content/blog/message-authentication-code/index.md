---
title: Message Authentication Code (MAC)
date: "2021-09-18T11:11:00.284Z"
description: "What is a Message Authentication Code and what is it used for?"
---

After our long journey learning about and attacking common block ciphers it's time for a new segment, this time we will dive into what is a Message Authentication Code (MAC) and common implementations. Maybe we will even dive into some common implementation mistakes, why not?!

This series will be divided into the following posts:

1. **Message Authentication Code (MAC)**
2. CBC-MAC (ECBC) and CMAC
3. NMAC
4. PMAC
5. HMAC
6. Poly1305-AES

## So what is a Message Authentication Code (MAC)?

It is a way to provide message _integrity_ without confidentiality, meaning an attacker can see a message but cannot modify it.

It's split into two functions:

1. A function that _signs_ a message
    * `S(key, message) -> tag`
2. A function that _verifies_ a message
    * `V(key, message, tag) -> boolean`

The verification function will compute a new tag and compare it with the provided one, if they are the same it will return `true`, otherwise `false`.

Notice the `key` argument being passed to both functions. In order to enforce integrity both parties are required to have a shared secret key. It's worth repeating, without a shared secret key a MAC cannot guarantee the integrity of a message.

More formally, a MAC system is considered secure if an attacker who is given the tag on arbitrary messages of his choice cannot construct a tag for some new message. 

## Examples

Far from being an exhaustive list, the two examples below are just there to demonstrate that technologies that are used on a daily basis also employ MACs to guarantee integrity.

**Webhooks**

Webhooks are usually sent with an associated MAC in order to verify authenticity and consistency of a message, as in, we know where it is coming from and that it haven't been tampered with. 

**JSON Web Token (JWT)**

JWTs can be signed with HMAC, which is a type of MAC in order to verify its integrity. These JWTs are usually called _signed tokens_ and are _not secret_. HMAC is not the only algorithm used by JWT that can provide integrity though, RSA or ECDSA are algorithms that can provide _secrecy and integrity_.

## Types of MAC

MACs are usually constructed in one of the following ways:

1. Through block cipher algorithms
    * CBC-MAC (ECBC), CMAC, PMAC, ...
2. Through cryptographic hash functions 
    * HMAC being the most well known
3. Universal hashing
    * UMAC-VMAC, Poly1305-AES, ...

That's all we are covering for now. Throughout future posts we will investigate some of these algorithms and explore common flaws in implementation that could be exploited by attackers.
