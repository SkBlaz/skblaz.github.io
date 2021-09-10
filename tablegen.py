## generate a simple table
import glob
import hashlib
handle = open("gallery_template.html", "rt")
template = handle.read()
handle.close()
all_images = glob.glob("random_art/*")
joint_string = []
for image in all_images:
    hash_object = hashlib.md5(image.encode())
    hid = hash_object.hexdigest()
    template_html = f"""                   <div class="text-center"> <div class="         "><img class="img-fluid zoom" src={image}></img></div>{hid}</div>"""
    joint_string.append(template_html)
final_string = "\n".join(joint_string)
template = template.replace("{GENERATED_DATA}",final_string)
with open("gallery.html","w") as gal:
    gal.write(template)
    
