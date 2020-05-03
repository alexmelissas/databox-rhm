CREATE TABLE `sessions` (
  `pin` varchar(16) NOT NULL,
  `targetPIN` varchar(16) NOT NULL,
  `publickey` varchar(200) DEFAULT NULL,
  `ip` varchar(15) DEFAULT NULL,
  `usertype` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  PRIMARY KEY (`pin`)
)

CREATE TABLE `databoxrhm` (
  `pin` varchar(16) NOT NULL,
  `data` text,
  `checksum` text,
  `ttl` int(1) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)