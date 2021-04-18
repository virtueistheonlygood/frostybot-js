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
  `order_price` DECIMAL NOT NULL,
  `trigger_price` DECIMAL NULL,
  `size_base` DECIMAL NOT NULL,
  `size_quote` DECIMAL NOT NULL,
  `size_usd` DECIMAL NOT NULL,
  `filled_base` DECIMAL NOT NULL,
  `filled_quote` DECIMAL NOT NULL,
  `filled_usd` DECIMAL NOT NULL,
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