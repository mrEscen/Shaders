#version 420

// based on https://www.shadertoy.com/view/Xl2BRR

layout(binding=0) uniform sampler2D 		texture;
layout(binding=1) uniform sampler2D 		depthtexture;

uniform vec3 camPos;
uniform vec3 camDir;
uniform vec3 windDir;


uniform	float fogDistFar;
uniform	float fogDistNear;
uniform	float FogDensity;
uniform float windForce;
uniform float SnowCrisp;
uniform float time;

float fade;

vec2 Resolution=vec2(1024,1024);
 
in vec2 TexCoord;
out vec4 FragColor;
float amount = 0.15;

#define SNOW_VOXEL_STEPS 20 // SNOW_VOXEL_STEPS * SNOW_VOXEL_STEP_SIZE == amount/distance snowflakes
#define SNOW_VOXEL_STEP_SIZE 3
#define SNOW_RADIUS .04


float distanceRayPoint(vec3 ro, vec3 rd, vec3 p, out float h) {
    h = dot(p-ro,rd);
    return length(p-ro-rd*h);
}

mat2 rot, rot2;


float hash( float n ) { return fract(sin(n)*43758.5453123); }

vec3 hash33( const in vec3 p) {
    return fract(vec3(
        sin( dot(p,    vec3(127.1, 311.7, 758.5453123))),
        sin( dot(p.zyx,vec3(127.1, 311.7, 758.5453123))),
        sin( dot(p.yxz,vec3(127.1, 311.7, 758.5453123))))*43758.5453123);
}


vec4 renderSnowField(in vec3 ro, in vec3 rd, in float tmax, vec3 depth) { 

	float fragDepth =depth.r;
    vec3 ros = ro;
    ros /= SNOW_VOXEL_STEP_SIZE;
	vec3 offset, id,
         pos = floor(ros),
	     mm, ri = 1./rd,
		 rs = sign(rd),
		 dis = (pos-ros + .5 + rs*.5) * ri;
    float dint, d = 0.;
    vec4 col = vec4(0),sum = vec4(0);
	dint=0.1;
    float dof = 5.0; 
	for( int i=0; i<SNOW_VOXEL_STEPS; i++ ) {
        id = hash33(pos);
        offset = clamp(id+.4*cos(id+(id.x)*time),SNOW_RADIUS, 1.-SNOW_RADIUS);
		
        d = distanceRayPoint(ros, rd, pos+offset, dint);

		float drupdis = 2.0*dint;
		float depthlayer=drupdis/15000;;
        if (dint>0.&& dint*SNOW_VOXEL_STEP_SIZE<tmax && depthlayer<fragDepth) {
            col.rgb = vec3(0.5,0.5,0.5);
			
            col = (vec4(.6+.4*col.rgb, 1.)*(1.-smoothstep(SNOW_RADIUS*.5,SNOW_RADIUS,d)));
            col.a *= smoothstep(float(SNOW_VOXEL_STEPS/22.),0.,dint);
			
            col.rgb *= col.a/(dint); //snowFlake bright fallof	
			float edge = 0.003 +0.05*min(.5*abs(-dof),1.);
			col.rgb += smoothstep(edge,-edge,d);	
			float distDanking = (1.0-(1.0/tmax)*(dint*SNOW_VOXEL_STEP_SIZE)); // darking on distance
            sum += (1.-sum.a)*(col*distDanking);
			
            if (sum.a>.99) break;

        }
		
		mm = (step(dis, dis.yxy) * step(dis, dis.zzx));
		dis += mm * rs * ri;
        pos += mm * rs;

	}
	//sum.rgb = clamp(sum.rgb,0.0,0.36);
	return sum;
}
vec4 renderFog(vec3 depth, vec4 baseColor){

	float dist = depth.r;
	vec4 finalFogColor = vec4(0, 0, 0, 1);
	vec4 fogColor = vec4(0.75, 0.75,0.75,1.0);
			//linear fog		
			float fogFactor = 1.0 /exp( ((fogDistFar*dist) * FogDensity)* ((fogDistNear*dist) * FogDensity));
			finalFogColor = mix(fogColor, baseColor, fogFactor);
	return finalFogColor;
}

mat3 setCamera( in vec3 ro, in vec3 ta, in float cr) {
	vec3 cw = normalize(ro-ta),
         cp = vec3(sin(cr), cos(cr),0.),
         cu = normalize( cross(cw,cp) ),
         cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

vec3 screenBlending( vec3 s, vec3 d )
{
	return s + d - s * d;
}
void main()
{

	vec4 col = texture2D(texture, TexCoord.xy);
	if (camPos.y >900 ){
	
		vec3 pos, ro, rd = vec3(0), colorSum = vec3(0);
     
    	// camera	
        vec2 q = (TexCoord.xy);
        vec2 p = -1.0+2.0*q;
        p.x *= (Resolution.x/Resolution.y);

		//vec3 m = vec3(camDir.x,camDir.y,camDir.z);
		
		//direction to angle
		float angleHor = -atan(camDir.x, camDir.z);   //radians
		angleHor = (360+angleHor);//%360; 
		float angleVer = (atan(camDir.y)/1.0);
		
		float grafity = 40.;

		vec3 windDir1 = vec3(-windDir.x,grafity,-windDir.z)*(windForce/50.);
		pos = (camPos+(windDir1*time*0.1))/10.0;
		
		vec3 taVec = vec3(cos(angleHor-0.3),sin(angleVer),sin(angleHor-0.3));
		ro = vec3(pos.x+taVec.x,(pos.y+taVec.y),pos.z+taVec.z);

		//vec3 ta = vec3(pos.x,pos.y,pos.z);

		// camera-to-world transformation
		mat3 ca = setCamera(ro, pos, 0.);

		// ray direction
		rd = ca * normalize( vec3(p.xy,1.5) ); 

		vec3 depth=texture2D(depthtexture, TexCoord.xy).xyz;
		
		vec4 fogColor = renderFog(depth, col);
		
		float t = 90.0f;
		vec4 snow = renderSnowField(ro, rd, t, depth);
		
		//blending 'screen'
		FragColor.rgb = screenBlending(fogColor.rgb , snow.rgb*SnowCrisp);
		
	}else{
		FragColor = col;
	}
}
