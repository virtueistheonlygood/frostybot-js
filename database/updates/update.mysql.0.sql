-- Version 0

--
-- Create logs table
--

CREATE TABLE IF NOT EXISTS `logs` (
  `uid` int unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(10) NOT NULL,
  `message` text NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `IDX_UUID_TS` (`uuid`,`timestamp`)
) ENGINE=InnoDB AUTO_INCREMENT=9434 DEFAULT CHARSET=latin1;

-- Version 1

--
-- Table structure for table `signals`
--

CREATE TABLE `signals` (
  `uid` INT NOT NULL AUTO_INCREMENT,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `provider` VARCHAR(36) NOT NULL,
  `user` VARCHAR(36) NOT NULL,
  `exchange` VARCHAR(50) NOT NULL,
  `stub` VARCHAR(50) NOT NULL,
  `symbol` VARCHAR(50) NOT NULL,
  `signal` VARCHAR(50) NOT NULL,
  `result` TINYINT NOT NULL,
  `message` TEXT NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) VISIBLE,
  INDEX `IDX_PROVIDER` (`provider` ASC) INVISIBLE,
  INDEX `IDX_USER` (`user` ASC) VISIBLE,
  INDEX `IDX_TIMESTAMP` (`timestamp` ASC) INVISIBLE,
  INDEX `IDX_RESULT` (`result` ASC) VISIBLE);



--
-- Table structure for table `orders`
--


CREATE TABLE `orders` (
  `uid` BIGINT NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(36) NOT NULL,
  `stub` VARCHAR(20) NOT NULL,
  `orderid` VARCHAR(15) NOT NULL,
  `customid` VARCHAR(15) NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `timestamp` TIMESTAMP NOT NULL,
  `type` VARCHAR(15) NOT NULL,
  `direction` VARCHAR(4) NOT NULL,
  `order_price` DECIMAL(18, 8) NOT NULL,
  `trigger_price` DECIMAL(18, 8) NULL,
  `size_base` DECIMAL(18, 8) NOT NULL,
  `size_quote` DECIMAL(18, 8) NOT NULL,
  `size_usd` DECIMAL(18, 8) NOT NULL,
  `filled_base` DECIMAL(18, 8) NOT NULL,
  `filled_quote` DECIMAL(18, 8) NOT NULL,
  `filled_usd` DECIMAL(18, 8) NOT NULL,
  `status` VARCHAR(15) NOT NULL,
  `metadata` TEXT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `uid_UNIQUE` (`uid` ASC) VISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_ORDERID` (`uuid` ASC, `stub` ASC, `orderid` ASC) INVISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_CUSTOMID` (`uuid` ASC, `stub` ASC, `customid` ASC) VISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_TS` (`uuid` ASC, `stub` ASC, `timestamp` ASC) INVISIBLE,
  INDEX `IDX_ORDERS_UUID_STUB_SYMBOL` (`uuid` ASC, `stub` ASC, `symbol` ASC) VISIBLE);


--
-- Update version
--

REPLACE INTO `settings` (`mainkey`, `subkey`, `value`) VALUES ('core', 'mysql:dbver', '3');