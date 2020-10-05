var scroll_v = 1;
$( document ).ready(function() {
  document.getElementById("canvas-clip").remove();

  if (window.location.href.indexOf('http') == -1)
    window.location.href = (window.location.href.replace("file:///var/www/html", "http://localhost"));

  const canvas = document.querySelector('#glcanvas');
  canvas.width = w;
  canvas.height = h;

  const gl = canvas.getContext('webgl2');
  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  const scene = new Scene(gl, GETscene); 

  if (scene.nMpis == 1 && false) {
    var oImg = document.createElement("img");
    oImg.setAttribute('src', GETscene + '/mpi.png');
    oImg.setAttribute('width', '100%');
    document.body.appendChild(oImg);
    oImg = document.createElement("img");
    oImg.setAttribute('src', GETscene + '/mpi_alpha.png');
    oImg.setAttribute('width', '100%');
    document.body.appendChild(oImg);
  }

  var leftright = 0, updown = 0;
  var radius_total = 60, step_radius = 0, spiral_inout = 0;

  var tx = 0, ty = 0;
  var zoom = 0;
  var firstPlane = 0;
  var lastPlane = scene.nPlanes - 1;
  var spin_speed = 0, spin_radius = 30;
  var anim_time = 0;

  var center = planes[0];
  if (Array.isArray(planes[0])) {
    center = planes[0][0];
  }

  if (typeof rotationPlane != 'undefined') 
    center = rotationPlane;

  var rotation_factor = 0.3;

  var drag = false;
  var old_x, old_y;
  var dX = 0, dY = 0;

  var mouseDown = function(e) {
    drag = true;
    if (e.touches == undefined) 
      old_x = e.pageX, old_y = e.pageY;
    else
      old_x = e.touches[0].pageX, old_y = e.touches[0].pageY;
    e.preventDefault();
    return false;
  };

  var mouseUp = function(e){
    drag = false;
  };

  var mouseMove = function(e) {
    if (!drag) return false;
    
    if (e.touches == undefined) 
      mx = e.pageX, my = e.pageY;
    else
      mx = e.touches[0].pageX, my = e.touches[0].pageY;

    dX = (mx-old_x)*2*Math.PI/canvas.width,
    dY = (my-old_y)*2*Math.PI/canvas.height;

    old_x = mx, old_y = my;
    
    leftright += dX * rotation_factor;
    updown += dY * rotation_factor;

    if (0) {
    if (leftright > 0.3) leftright = 0.3;
    if (leftright < -2.3) leftright = -2.3;
    //tx -= dX * rotation_factor;
    //ty -= dY * rotation_factor;
    if (updown > 0.3) updown = 0.3;
    if (updown < -0.1) updown = -0.1;
    }
    e.preventDefault();
    //console.log(updown);
  };

  var mousewheel = function(e) {
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    zoom += delta / 20.0;
    scroll_v = zoom;
    console.log(zoom);
    //console.log(scroll_v);
  }

  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mouseup", mouseUp, false);
  canvas.addEventListener("mouseout", mouseUp, false);
  canvas.addEventListener("mousemove", mouseMove, false);
  canvas.addEventListener("mousewheel", mousewheel, false);

  canvas.addEventListener("touchstart", mouseDown, false);
  canvas.addEventListener("touchend", mouseUp, false);
  canvas.addEventListener("touchmove", mouseMove, false);


  var then = 0;
  var frameCount = 0;
  var d = new Date();
  var lastTime = new Date().getTime();

  var movement = {
    "spiral": function(modelViewMatrix){
      mat4.rotate(modelViewMatrix, modelViewMatrix, updown, [1, 0, 0]);      
      mat4.rotate(modelViewMatrix, modelViewMatrix, -leftright, [0, 1, 0]); 
      if(spin_speed > 0){
        mat4.translate(modelViewMatrix, modelViewMatrix, [updown, -leftright, spiral_inout]);   
      }
      return modelViewMatrix;
    },
    "spiral_llff": function(unused){
      let theta = step_radius / radius_total * 2 * Math.PI;
      var zrate = 0.5;
      var rads = spin_radius / 50;
      var cameraPosition = vec3.fromValues(
        Math.cos(theta) * rads,
        -Math.sin(theta) * rads, 
        -Math.sin(theta*zrate) * rads);

      var target = vec3.fromValues(0, 0, -center);
      var up = vec3.fromValues(0, 1, 0)

      var m4 = mat4.create();
      mat4.lookAt(m4, cameraPosition, target, up);
      mat4.invert(m4, m4);
      return m4; 
    },
    "horizontal": function(modelViewMatrix){
      mat4.rotate(modelViewMatrix, modelViewMatrix, leftright, [0, 1, 0]);  
      return modelViewMatrix;
    },
    "veritcal": function(modelViewMatrix){
      mat4.rotate(modelViewMatrix, modelViewMatrix, updown, [1, 0, 0]);      
      return modelViewMatrix;
    },
    "linear_vertical": function(modelViewMatrix){
      mat4.translate(modelViewMatrix, modelViewMatrix, [0, updown, 0]);       
      return modelViewMatrix;
    },
    "linear_horizontal": function(modelViewMatrix){
      mat4.translate(modelViewMatrix, modelViewMatrix, [leftright, 0, 0]);       
      return modelViewMatrix;
    },
  }

  function getModelViewMatrix(offx = 0){
    var modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [tx, ty, -(center + zoom)]); 
    mat4.rotate(modelViewMatrix, modelViewMatrix, offx, [1, 0, 0]);
    return modelViewMatrix;
  }

  function moveMatrixFromOirin(modelViewMatrix, offx = 0){
    mat4.rotate(modelViewMatrix, modelViewMatrix, -offx, [1, 0, 0]);       
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0.0, center]); 
    if (typeof rotate != 'undefined' && rotate == 1) {
      mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 2, [0, 0, 1]);       
    }
    return modelViewMatrix;
  }
  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    if (spin_speed > 0) {
      anim_time += deltaTime * spin_speed * 0.1;
      leftright = Math.sin(anim_time) * spin_radius / 500;
      updown = Math.cos(anim_time) * spin_radius / 500;
      spiral_inout = Math.sin(anim_time * 0.5) * spin_radius / 500;

      step_radius += deltaTime * spin_speed;
    }
    //console.log(deltaTime);

    if (scene.ready) {
      var viewMatrix;
      if(movement_type != 'spiral_llff'){
        viewMatrix = getModelViewMatrix();
        viewMatrix = movement[movement_type](viewMatrix);
        viewMatrix = moveMatrixFromOirin(viewMatrix);  
      }else{
        viewMatrix = movement['spiral_llff']();
      }
      scene.drawSceneNoVR(viewMatrix, deltaTime, firstPlane, lastPlane);
    }

    requestAnimationFrame(render);
    
    if (scene.ready) {
      frameCount ++;
      if (frameCount == 100) {
        var now = new Date().getTime(); 
        $("#fps").text("FPS: " + Math.round(100000 / (now - lastTime)));
        lastTime = now;
        frameCount = 0;
      }
    } else {
      $("#fps").text("Loading textures: " + scene.textureLoadedCount + " out of " + scene.textureTotalCount);
    }
  }
  requestAnimationFrame(render);


  if ($("#rotation_plane").length) {
    $("#rotation_plane").slider({
      range: false,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0 ],
      slide: function( event, ui ) {
        $("#center").html(ui.values[ 0 ]);
        if (scene.planes_is_2d)
          center = planes[0][ui.values[0]];
        else
          center = planes[ui.values[0]];
      }
    });
  }
  if ($("#show_plane").length) {
    $("#show_plane").slider({
      range: false,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0 ],
      slide: function( event, ui ) {
        $("#plane").html(ui.values[ 0 ]);
        $("#rendered_planes").slider("values", [ui.values[0], ui.values[0]]);
        firstPlane = ui.values[0];
        lastPlane = ui.values[0];
        $( "#amount" ).html(ui.values[ 0 ] + " - " + ui.values[ 0 ] );
      }
    });
  }
  if ($("#rendered_planes").length) {
    $("#rendered_planes").slider({
      range: true,
      min: 0,
      max: scene.nPlanes-1,
      values: [ 0, scene.nPlanes-1 ],
      slide: function( event, ui ) {
        firstPlane = ui.values[0];
        lastPlane = ui.values[1];
        $( "#amount" ).html(ui.values[ 0 ] + " - " + ui.values[ 1 ] );
      }
    });
    $("#amount" ).html( "" + $( "#rendered_planes" ).slider( "values", 0 ) +
      " - " + $( "#rendered_planes" ).slider( "values", 1 ) );
  }
  if ($("#spin_radius").length) {
    $("#spin_radius").slider({
      range: false,
      min: 0,
      max: 100,
      values: [ 30 ],
      slide: function( event, ui ) {
        $("#radius").html(ui.values[ 0 ]);
        spin_radius = ui.values[0];
      }
    });
  }
  if ($("#spin_speed").length) {
    $("#spin_speed").slider({
      range: false,
      min: 0,
      max: 100,
      values: [ 0 ],
      slide: function( event, ui ) {
        $("#speed").html(ui.values[ 0 ]);
        spin_speed = ui.values[0];
      }
    });
  }

  //determine movement
  var movement_type = 'spiral';
  $("#path-selector").change(function(){
    movement_type = $("#path-selector").val();
  });
  
});
