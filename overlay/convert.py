import json

# Load the JSON data
with open('json.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

sprite_entries = {}

# Traverse the JSON structure
for frame in data['java']['object']['void'][0]['array']['void']:
    frame_obj = frame['object']
    # Get the sheet name
    filename = None
    for v in frame_obj['void']:
        if v.get('_property') == 'filename':
            filename = v['string']
            break
    if not filename:
        continue

    # Find the frameEntries array
    entries = None
    for v in frame_obj['void']:
        if isinstance(v, dict) and 'array' in v:
            entries = v['array']['void']
            break
    if not entries:
        continue

    for entry in entries:
        entry_obj = entry['object']
        entry_data = {'sheet': filename}
        name = None
        # Default values
        entry_data['x'] = 0
        entry_data['y'] = 0
        entry_data['width'] = 32
        entry_data['height'] = 32
        for prop in entry_obj['void']:
            if prop.get('_property') == 'name':
                name = prop['string']
            elif prop.get('_property') == 'XCoord':
                entry_data['x'] = int(prop['int'])
            elif prop.get('_property') == 'YCoord':
                entry_data['y'] = int(prop['int'])
            elif prop.get('_property') == 'width':
                entry_data['width'] = int(prop['int'])
            elif prop.get('_property') == 'height':
                entry_data['height'] = int(prop['int'])
        if name:
            sprite_entries[name] = entry_data

# Write to spriteData.js
with open('spriteData.js', 'w', encoding='utf-8') as f:
    f.write('window.SPRITE_DATA = {\n')
    for k, v in sprite_entries.items():
        f.write(f'    "{k}": {{ sheet: "{v["sheet"]}", x: {v["x"]}, y: {v["y"]}, width: {v["width"]}, height: {v["height"]} }},\n')
    f.write('};\n')

print(f"Extracted {len(sprite_entries)} sprite entries to spriteData.js")