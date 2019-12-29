# Alex Melissas
## databox-rhm

A Remote Health Monitoring system using databox. 
Uses two databox drivers (client-caretaker) and a relay server (Ubuntu @ AmazonAWS) with a Redis Cluster (for now)

## Functionality so far:
- Read/Write HR/BPH/BPL readings simply using get/post
- Pass readings into relay server using POST
- Relay server stores readings into redis cluster
