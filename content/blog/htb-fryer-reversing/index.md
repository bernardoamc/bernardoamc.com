---
title: Cybersecurity Awareness Month CTF reversing challenge
date: "2024-10-26T18:00:00.284Z"
description: "Reversing the fryer binary from the Cybersecurity Awareness Month CTF with GDB and some C, because why not?"
---

This year I became aware of `Cybersecurity Awareness Month CTF` from `HTB` after it happened, but still managed to grab myself one of the reverse engineering challenges from the event called `fryer`, because why not?

Let's see how the binary works:

```bash
$ ./fryer
Please enter your recipe for frying: whataboutcookies?
got:      `e?ktuwciahoabotos`
expected: `1_n3}f3br9Ty{_6_rHnf01fg_14rlbtB60tuarun0c_tr1y3`
This recipe isn't right :(
```

Our binary expects an input, transforms it somehow and checks it against a fixed string. Let's see how things look through `gdb`. 

Calling `disass main` shows the overall shape of our `main` function. I've omitted parts that are not relevant to the challenge in order to focus on the important aspects of the code:

```asm
gef> disass main

call   0x1090 <fgets@plt> # Reads our input
...
mov    rdi,rsp
call   0x11b9 <fryer>     # fryer function is called with our input
...
lea    rdi,[rip+0xd67]
mov    eax,0x0
call   0x1080 <printf@plt> # Prints the got/expected message
mov    rsi,rsp
mov    rdi,rbp
call   0x10a0 <strcmp@plt> # Compares our transformed input with the expected string
test   eax,eax
je     0x130a <main+200>   # Sends us to success/failure path
```

So at this point I have a single question:

1. How does the `fryer` function transforms our input?

Let's inspect `fryer`

```bash
gef> disass fryer

mov    DWORD PTR [rip+0x2ea5],0x13377331
mov    DWORD PTR [rip+0x2e9f],0x1 
mov    rdi,rbp
call   0x555555555040 <strlen@plt>
mov    r12,rax
cmp    rax,0x1
jbe    0x555555555239 <fryer+128>
lea    r14,[rax-0x1]
mov    ebx,0x0
lea    r13,[rip+0x2e7a]
mov    rdi,r13
call   0x555555555060 <rand_r@plt>
cdqe
mov    rcx,r12
sub    rcx,rbx
mov    edx,0x0
div    rcx
add    edx,ebx
movzx  eax,BYTE PTR [rbp+rbx*1+0x0]
movsxd rdx,edx
add    rdx,rbp
movzx  ecx,BYTE PTR [rdx]
mov    BYTE PTR [rbp+rbx*1+0x0],cl
mov    BYTE PTR [rdx],al
add    rbx,0x1
cmp    rbx,r14
jne    0x555555555202 <fryer+73> # Back to mov rdi,r13
```

This looks complicated, but let's break it down:

1. Store the following values: `0x13377331` and `0x1`
2. Get the length of our input and store it in `r12` through `strlen`
3. Abort process if our input is a single character
4. Store the length of our input minus one in `r14`
5. Store `0` into `ebx`
6. Store `0x13377331` in `rdi` and call `rand_r` with it.

This is where things start:

1. Move `r12` into `rcx`, which is the length of our input
2. Subtract `rbx` from `rcx`, which is currently is zero
3. Store zero into `edx`
4. Call `div` on `rcx`, which sets the resulting value into `rdx`
5. Add `ebx` and `rdx`

That `div` operation will divide our "random number" by the value we computed and keep the remainder, so we can think of it as the modulus operator for our purposes. We can visualize this entire process as:

```rb
input_len = input.length
random_number = rand_r(0x13377331)
value = (random_number % (input_len - 0)) + 0
```

Let's keep going:

1. Move `[rbp+rbx*1+0x0]` into `eax`, which is the first letter of our input
    - `rbp` points to our input and `rbx` is currently zero
2. Add `rdx` to `rbp`, so now `rdx` points to a random place in our input
3. Move a byte in that location to `ecx`
4. Move that byte to `[rbp+rbx*1+0x0]`, which is the first letter of our input
5. Move `eax`, which was the original first character into the `rdx`position

So we have:

```rb
temp = input[0]
input[0] = input[rdx] # rdx is our "random value"
input[rdx] = temp
```

Which means we just swap the value in these two positions. What next?

1. Add 1 to `rbx`
2. Compare it with `r14`, which is our input length minus one
3. If the value is smaller, jump back to `mov rdi,r13`

So now we have the full picture of what is happening:

1. Iterate over characters in our input
2. Get a "random number" and compute an index with it
3. Swap values from the current index with the computed index
4. Stop when we reach the end of our input

Since we have access to the seed, we can reproduce what is happening. Let's write a quick program in C to test our hypothesis:

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void fryer(char *input) {
    size_t size = strlen(input);
    unsigned int seed = 0x13377331;

    for (size_t i = 0; i < size; i++) {
        unsigned int random_number = rand_r(&seed);
        size_t computed_index = (random_number % (size - i)) + i;
        char temp = input[i];
        input[i] = input[computed_index];
        input[computed_index] = temp;
    }
}

int main() {
    char input[48];
    printf("Enter value: ");
    scanf("%s", input);
    fryer(input);
    printf("Shuffled input: %s\n", input);

    return 0;
}
```


And running it with our original input yields:

```bash
$ ./test 
[Enter value: whataboutcookies?
Shuffled input: e?ktuwciahoabotos
```

Which is the same output as our `fryer` binary!

At this point we know exactly what is happening, so how can we reverse this? Well, what do we know?

1. `rand_r` is predictable since we always use the same seed
2. We know the equation that computes indexes to be swapped
3. We know swapping occurs from beginning to the end of our input

Given that, we can reverse the algorithm in the following way:

1. Compute the list of indexes to be swapped
2. Start from the end of our input and swap back our values
3. Repeat until we get to the beginning of our input

Which gives us this:

```c
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

int main() {
  char input[] = "1_n3}f3br9Ty{_6_rHnf01fg_14rlbtB60tuarun0c_tr1y3"; 
  int length = strlen(input);
  int indexes[length - 1];
  unsigned int seed = 0x13377331;
  
  // Compute our indexes ahead of time so we can backtrack
  for (int i = 0; i < length - 1; i++) {
      indexes[i] = rand_r(&seed) % (length - i) + i;
  }

  // Now we start reverting the process from the end to the beginning
  for (int i = length - 1; i >= 0; i--) {
    char temp = input[i];
    input[i] = input[indexes[i]];
    input[indexes[i]] = temp;
  }

  printf("%s\n", input);

  return 0;
}
```

And after compiling the program, we get our flag!

```bash
$ ./test 
[HTB{4_truly_t3rr0r_fry1ng_funct10n_9b3ab6160f31}
```

So overall a straighforward challenge, but it was fun to only rely on `gdb` to solve it. This could have likely be solved with `angr`, but I couldn't find a decent way of doing it, let me know if you do!