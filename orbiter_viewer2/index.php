<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>WebGL Orbiter Renderer</title>
    <link rel="stylesheet" href="css/webgl.css" type="text/css">
  </head>

  <body>
<div id='folderlist'>
<?php
function scan($target) {
  $files = glob( $target . '*', GLOB_MARK ); //GLOB_MARK adds a slash to directories returned
  foreach( $files as $file ) {
    if (is_dir($file)) {
      scan( $file );
      if (file_exists($file . "config.js"))
        echo "<a href='?scene=$file'>$file</a><br>";
    }
  }
}

scan("data/");
?>
</div>
    <div id="canvas-clip">
      <canvas id="webgl-canvas"></canvas>
    </div>

    <canvas id="glcanvas"></canvas>
    <div id="workspace"></div>
  </body>
  <script src="js/jquery-3.4.1.min.js"></script>

  <script src="js/third-party/gl-matrix-min.js"></script>

  <script src="js/third-party/wglu/wglu-program.js"></script>
  <script src="js/third-party/wglu/wglu-stats.js"></script>
  <script src="js/third-party/wglu/wglu-texture.js"></script>
  <script src="js/third-party/wglu/wglu-url.js"></script>

  <script src="js/vr-samples-util.js"></script>
  <script src="js/gl-utils.js"></script>
  <script src="js/loader.js"></script>
</html>
