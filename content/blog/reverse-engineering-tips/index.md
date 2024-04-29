---
title: Reverse Engineering Tips
date: "2024-04-28T08:00:00.284Z"
description: "Going over commands that helped me reverse engineer a binary or two."
---

This blog post will be very different from my usual ones in which we either have a problem to solve or some idea to explore. This time we will have a disjointed set of techniques vaguely related to reverse engineering.

## Locating main in a stripped binary

The TL;DR; is that `__libc_start_main()` receives the address of `main` as its first argument, so we can:

1. Use `readelf` to find the address of `__libc_start_main()`
2. Check the address that is being called from it, which will be `main`

That would be:

```sh
$ readelf -h <binary> | grep Entry
Entry point address:               0x103120
```

Then we can `gdb` our way through it:

```sh
gdb ./<binary>

> b *0x103120
> run
```

Now we can step through a few instructions until we hit the `CALL` instruction to `__libc_start_main()`. Since the first argument will be our `main` address we can inspect the value of `rdi` before the call and break on that address.

## Deriving the meaning of argument masks

Let's say we have a command like the following one in our binary:

```c
char* buf = mmap(nullptr, _init, 0, 0x21, 0xffffffff, 0);
```

We know that `mmap` expects the following arguments:

```
void * mmap(void *addr, size_t len, int prot, int flags, int fd, off_t offset);
```

But `prot` and `flags` are a conjunction of `or`ed values. So how do we figured out what `0` and `0x21` means for the `proto` and `flags` arguments?

The first thing to figure out is the name of the `header` file responsible for `mmap`. Luckily `man` can give us an answer.

```sh
$ man 2 mmap

NAME
     mmap – allocate memory, or map files or devices into memory

SYNOPSIS
     #include <sys/mman.h>
```

Now we can use `gcc` with the following flags:

1. `-E` to only run the preprocessor
2. `-` to receive the input from `stdin`
3. `-dM` to print macro definitions in -E mode instead of normal output

Putting all of those together we can find the values for `proto` and `flags` by checking in our `man` pages for the expected flag formats:

```sh
echo '#include <sys/mman.h>' | gcc -E - -dM | rg "MAP_"
#define MAP_32BIT 0x8000
#define MAP_ANON 0x1000
...
#define MAP_SHARED 0x0001
```

and

```sh
$ echo '#include <sys/mman.h>' | gcc -E - -dM | rg "PROT_"
#define PROT_EXEC 0x04
#define PROT_NONE 0x00
#define PROT_READ 0x01
#define PROT_WRITE 0x02
```

In the case of `mmap` we can also check the output of the function call with `info proc mappings`.

## Figuring out headers search path

We can use `gcc` to give us this answer.

```sh
$ gcc -E -Wp,-v -xc /dev/null

# ...
#include "..." search starts here:
#include <...> search starts here:
 /usr/local/include
 ...
End of search list.
```

`gcc --help` has a nice explanation for each of those flags.

## "Replacing" functions in dynamically linked binaries

We an use `LD_PRELOAD` to call our own version of our functions instead of whatever else is being dynamically linked to it. Let's say we have a binary like this one:

```c
#include <stdio.h>

void main() {
  puts("Original");
}
```

We can compile our own shared library with our own `puts` function:

```c
#include <stdio.h>

int puts(const char *s) {
  printf("Hijacked");

  return 0;
}
```

Now need to compile it as a shared library: 

```sh
$ gcc our_puts.c -o our_puts.so -fPIC -shared -ldl
```

Finally we can execute our binary:

```sh
$ LD_PRELOAD="./our_puts.so" ./binary
Hijacked
```

### What if we also want to use the value of the original function?

```c
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>

// This will be the pointer to our original puts function
int (*original_puts)(const char *s);

int puts(const char *s) {
  if(!original_puts) {
    original_puts = dlsym(RTLD_NEXT, "puts");
  }

  printf("Still hijacked");

  return original_puts(s);
}
```

We are using `dlsym` with `RTLD_NEXT` from `dlfcn.h` to get the pointer to the next version of `puts` in our preload chain.

Notice the `#define _GNU_SOURCE` in the beginning of our source code. It has to be defined according to our `man` pages in order for `RTLD_NEXT` to be defined as we can see in the snippet below:

```
The _GNU_SOURCE feature test macro must be defined in order to
obtain the definitions of RTLD_DEFAULT and RTLD_NEXT from
<dlfcn.h>.
```

```sh
$ gcc our_puts.c -o our_puts.so -fPIC -shared -ldl`
```

Finally we can execute our binary:

```sh
$ LD_PRELOAD="./our_puts.so" ./binary
Still hijacked
Original
```

## Conclusion

This is an area that I'm not familiar with, so these techniques are likely not optimal. If you have better (or different) ways to achieve what has been demonstrated please reach out and share it with me. See you next time! 