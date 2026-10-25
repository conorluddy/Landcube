# Coastal elevation regression fixture

`slieve-league-coast.json` contains a 24 × 20 pixel crop at pixel (20, 155) of the public [Terrarium tile 12/1949/1302](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/1949/1302.png), decoded to meters on 2026-10-25. It retains the abrupt source transitions observed near Slieve League, without requiring network access in tests.

The tile's source metadata names EU-DEM, SRTM, GMTED2010 and ETOPO1. Credit: Produced using Copernicus data and information funded by the European Union — EU-DEM layers; 3DEP, SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey; ETOPO1: DOC/NOAA/NESDIS/NCEI, U.S. Department of Commerce.

The optional elevation floor is a rendering mitigation, not a correction to source data. A higher tile zoom and the provider's Skadi HGT format both retained coastal artifacts in live comparisons. Existing configurations keep their original terrain sampling when the floor is omitted.
