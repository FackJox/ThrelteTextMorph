<script lang="ts">
  export let ref: any = null;
  export let geometry: any = null;
  export let material: any = null;
  export let rotation: [number, number, number] = [0, 0, 0];
  export let scale: [number, number, number] = [1, 1, 1];
  export let castShadow: boolean = false;
  export let receiveShadow: boolean = false;
  export let frustumCulled: boolean = true;

  const mesh = {
    geometry,
    material,
    rotation,
    scale,
    castShadow,
    receiveShadow,
    frustumCulled,
    position: {
      set: () => {}
    }
  };

  $: mesh.geometry = geometry;
  $: mesh.material = material;
  $: mesh.rotation = rotation;
  $: mesh.scale = scale;
  $: mesh.castShadow = castShadow;
  $: mesh.receiveShadow = receiveShadow;
  $: mesh.frustumCulled = frustumCulled;
  $: ref = mesh;
</script>

<div data-mesh>
  <slot />
</div>
