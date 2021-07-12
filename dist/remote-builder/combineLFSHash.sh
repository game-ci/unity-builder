#!/bin/sh

echo "Combining LFS hash files into one hash, this can be used to cache LFS files"
git lfs ls-files -l
git lfs ls-files -l | cut -d' ' -f1
git lfs ls-files -l | cut -d' ' -f1 | sort
git lfs ls-files -l | cut -d' ' -f1 | sort > $1/.lfs-assets-id
echo ' '
ls $1
echo 'combined file:'
cat $1/.lfs-assets-id
echo ' '
