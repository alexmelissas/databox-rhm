CREATE EVENT ttl_countdown
  ON SCHEDULE
    EVERY 1 DAY
  DO
    UPDATE databoxrhm
    SET ttl = ttl - 1;

    DELETE FROM databoxrhm
    WHERE ttl<1;