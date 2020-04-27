container=$(docker ps -a | grep srhm-caretaker-amd64 | cut -c1-12)
docker logs -f $container