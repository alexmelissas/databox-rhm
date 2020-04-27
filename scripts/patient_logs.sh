container=$(docker ps -a | grep srhm-patient-amd64 | cut -c1-12)
docker logs -f $container