---
title: Offensive Security Web Expert (OSWE) certification
date: "2022-07-04T12:30:00.284Z"
description: "A recap on my journey through the OSWE certification"
---
 
It has been a bit quiet here over the past few months, this is mostly due to my renewed focus into bouldering and more recently due to my journey through the Offensive Security Web Expert (OSWE) certification. I'm proud to say that I'm back into V8s (7B/7B+ or 5.12a/5.12b) and now OSWE certified. And while discussing bouldering is tempting, I'm focusing on the OSWE certification for this post.
 
This will not be an in-depth explanation of how OSWE is organized or what it covers since there are great posts out there detailing the entire process. This will be instead a summary of OSWE through my own lens.
 
## What is it?
 
This is a certification focused into white box web penetration tests. It aims to teach you the methodology to identify vulnerabilities in web applications through **source code reading**. Once the vulnerability chain is identified the end goal is to **automate the entire exploitation process**.
 
At this time (June 2022) the syllabus covers vulnerabilities in a wide array of programming languages and web frameworks. From the top of my mind I remember tackling web frameworks in Javascript, Java, Python, PHP and C#. They also cover a wide range of vulnerabilities, from the more common SQL injection to XSS or CSRF going up to SSTI, SSRFs, XXEs and serialization/deserialization vulnerabilities. It also covers some interesting RCE scenarios through libraries and binaries in our software supply chain. Please keep in mind that this is by no means supposed to be an exhaustive list.
 
## What did you like about it?
 
I've enjoyed how the course material tries to impart students with a methodology to assess different codebases. It's impossible to cover every technology or popular web framework out there, but having a solid methodology in place can help answer questions like "what should I prioritize?" or "where do I even start?". The course did a good job emphasising logging, debugging and grepping for code.
 
I've also enjoyed the extra machines that were available besides the ones that are covered in the course material. They are realistic and helped me validate if I internalized the methodology and concepts covered in the course. This is especially true since there are no walkthroughs available for them. And since the end goal is to automate the exploitation process you can be sure you will have a solid understanding of each vulnerability.
 
Last but not least, the community is pretty active on discord and offensive security forums. This is a great way to get help and to share knowledge. If you manage to find people going over the course at the same time, which is not that hard, you can even brainstorm a problem together.
 
## What could have been better?
 
I wish we had access to more hands-on machines that are aligned with the course content. While it's possible to find machines in HackTheBox or TryHackMe that are aligned with the course content it would be great if everything was bundled within the course material.
 
The second thing is how the exam is scored. Students are required to have a score of at least `85` out of `100` to pass. The exam consists of two machines, for each of those you will need to read 2 different files. The first file on each machine is scored `35` points each. The second file is scored `15` each. Last but not least, you cannot get to the second file without getting to the first. This structure means that failing to get one of the first files is an automatic exam failure. This adds a lot of pressure during the exam and I wonder if having more objectives could mitigate this all-or-nothing feeling.
 
## How's the exam?
 
The exam is a huge time commitment and lasts 72 hours. Students are expected to tackle two different machines in the first 48 hours where they have to complete a set of objectives like privilege escalation and remote code execution. The last 24 hours are dedicated to writing a report detailing how the objectives were identified, exploited and finally automated. I found the exam realistic and closely aligned with the course material.
 
## Any advice?
 
I'm glad you asked! There were a few things that made my experience better and that I would recommend:
 
1. Engage with the community. There are a lot of talented people around and you will find yourself teaching and learning from them.
2. Take notes. For every new technology or framework you encounter it pays off to write common insecure code patterns or general knowledge about the technology. This can drastically speed up your learning process and overall approach during code review.
3. Every chapter in the course material has extra assignments that you can do on your own and I highly recommend doing those. They are challenging and will help you learn more about each topic. More importantly, they will require the same mindset as the exam.
4. Take breaks during the exam to stretch, drink water and sleep. This is especially important when you find yourself stuck. Take a break, go for a walk, rethink your approach and carry on.
5. Write a high-level documentation about vulnerabilities during the exam, this will help you when writing the report and make sure you are not forgetting anything. Screenshots are an important part of the process.

## Conclusion

I would recommend the course to software developers interested in web security or people within application security that would like to get more comfortable with software development and source code reading. There's a lot of value in the course material and knowing that someone went through the material and finished the exam proves their commitment to learning and improving their skillset.

Stay safe everyone, and keep learning!
