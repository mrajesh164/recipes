<!-- Keep this short. The commit messages carry the reasoning; this carries
     what a reviewer needs in order to look in the right place. -->

Closes #

## What changed

<!-- One or two sentences. -->

## How it was checked

<!-- The actual check, not the intent. "132 tests pass, typecheck clean" is
     fine. "Looked at the signed-out page at 390px" is better than "tested
     responsive". -->

## What was not checked

<!-- Say it plainly. Much of this app is behind sign-in, so "the Saved view is
     verified by reading and compiling, not by eye" is a normal and useful
     answer. A reviewer who knows where the gap is can look there. -->

## Reviewed

<!-- Run /code-review on the branch before merging and say what it found, even
     if the answer is nothing. Locally rather than in CI on purpose: the model
     calls are not free, this is a one-person project, and a reviewer running
     next to the tests can see more than one running off a bare checkout. The
     cost of local is that it only happens when you remember, which is what
     this line is for. -->

- [ ] `/code-review` run on this branch
