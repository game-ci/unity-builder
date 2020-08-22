#!/bin/sh

# This creates a GKE Cluster
# - Will wait for any deletion to complete on a cluster with the same name before creating
# - Will wait for completion before continuing
# - If the script is run concurrently multiple times, only one cluster will be created, all instances will wait for availability
# Requires GCP Cloud SDK
# Installs retry https://github.com/kadwanev/retry

GKE_PROJECT=$1
GKE_CLUSTER=$2
GKE_ZONE=$3

# may update this to avoid repeated install, drop me a comment if needed
sudo sh -c "curl https://raw.githubusercontent.com/kadwanev/retry/master/retry -o /usr/local/bin/retry && chmod +x /usr/local/bin/retry"

attempts=0
while [ $attempts -le 1 ]
do
retry -s 15 -t 20 -v '
    STATUS=$(gcloud container clusters list --format="json" --project $GKE_PROJECT |
    jq "
    .[] |
    {name: .name, status: .status} |
    select(.name == \"$GKE_CLUSTER\")
    " |
    jq ".status")
    if [ "$STATUS" == "\"STOPPING\"" ]; then echo "Cluster stopping waiting for completion" && exit 1; fi
    exit 0
  '
cluster=$(gcloud container clusters list --project $GKE_PROJECT --format="json" | jq '.[] | select(.name == "${GKE_CLUSTER}")')

if [ -z "$cluster" ];
then
  echo "No clusters found for \"$GKE_CLUSTER\" in project \"$GKE_CLUSTER\" in zone \"$GKE_ZONE\""
  # you may not need this, it installs GCP beta for additional command line options
  gcloud components install beta -q
  # replace this line with whatever type of cluster you want to create
  gcloud beta container --project $GKE_PROJECT clusters create $GKE_CLUSTER --zone $GKE_ZONE --no-enable-basic-auth --cluster-version "1.15.12-gke.2" --machine-type "custom-1-3072" --image-type "COS" --disk-type "pd-standard" --disk-size "15" --metadata disable-legacy-endpoints=true --scopes "https://www.googleapis.com/auth/devstorage.read_only","https://www.googleapis.com/auth/logging.write","https://www.googleapis.com/auth/monitoring","https://www.googleapis.com/auth/servicecontrol","https://www.googleapis.com/auth/service.management.readonly","https://www.googleapis.com/auth/trace.append" --num-nodes "1" --enable-stackdriver-kubernetes --enable-ip-alias --default-max-pods-per-node "110" --enable-autoscaling --min-nodes "0" --max-nodes "3" --no-enable-master-authorized-networks --addons HorizontalPodAutoscaling,HttpLoadBalancing --enable-autoupgrade --enable-autorepair --max-surge-upgrade 1 --max-unavailable-upgrade 0
fi;
retry -s 15 -t 20 -v '
  STATUS=$(gcloud container clusters list --format="json" --project $GKE_PROJECT |
  jq "
  .[] |
  {name: .name, status: .status} |
  select(.name == \"$GKE_CLUSTER\")
  " |
  jq ".status")
  if [ "$STATUS" == "\"PROVISIONING\"" ]; then echo "Cluster provisioning waiting for available" && exit 1; fi
  exit 0
'
echo "Cluster is available"
gcloud container clusters get-credentials $GKE_CLUSTER --zone $GKE_ZONE --project $GKE_PROJECT
kubectl version
NSID=$(cat /proc/sys/kernel/random/uuid)
echo "::set-env name=NSID::"$NSID
{
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: ns-unity-builder-$NSID
  labels:
    app: unity-builder
EOF
} && exit 0

attempts=$(($attempts+1))
done
