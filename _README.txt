Question packs (PYQs)
=====================
Put question files in this folder and they are built into the app and the APK.
Files starting with an underscore (like this one) are ignored.

Accepted files: .txt  .json  .csv  .tsv   (the same formats the PYQs screen imports)

Text format:
    #exam CBSE Class 10
    #subject Science
    #year 2023
    #chapter Life Processes
    Q: Question text
    A) First option
    B) Second option
    C) Third option
    D) Fourth option
    Ans: B
    Exp: Optional explanation

Written (non-MCQ) question: leave out the options and put the model answer after "Ans:".
Numerical question: "Ans: 12.5".

Each file is loaded once per version. When you edit a file, the next build gives it a new version
and the app loads the changes. Check a file on a computer with:  node build.mjs check
