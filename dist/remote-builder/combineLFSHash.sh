#!/bin/sh

echo "Combining LFS hash files into one hash, this is used as the cache key:"
git lfs ls-files -l | cut -d' ' -f1 | sort > $1/lfsSum.txt
ls -a
cat $1/lfsSum.txt
