kubectl delete ns ns-unity-builder-$NSID

# do any unity-builder namespaces remain?
namespaceCount=$(kubectl get ns --output json | jq ".items | .[] | select(.metadata.labels.app == \"unity-builder\") | select(.status.phase != \"TERMINATING\")" | jq -s "length")
echo $namespaceCount
if [ "$namespaceCount" != "0" ]
then
   echo "let next cluster delete"
   exit 0
else
   echo "delete cluster"
   retry -s 15 -t 5 -v 'gcloud container clusters delete $GKE_CLUSTER --zone $GKE_ZONE --project $GKE_PROJECT --quiet'
fi
