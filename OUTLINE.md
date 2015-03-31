## Outline of charting operations

*(insert overview of how charts work here)*

#### Live VIEW/LAYOUT (client of chart)

	socket = SocketIO(url)
	chart = Chart(chart_setup, [tick_stream, bar_stream], #chart)
	chart.init(cb)
	socket.on('data'):
		if {packet is a tick}:
        	tick_stream.set(packet.data)
        	tick_stream.emit("update")
    	else if {packet is a candle}:
        	bar_stream.set(packet.data)
        	bar_stream.emit("update")

    	if {packet is a tick AND !chart_rendered}:
        	chart.render()

#### CHART

Constructor:

	{define chart properties}

init(cb):

	{load chart_setup}
	{load collection}
	anchor.on("update"):
		if (new_bar):
			if chart.rendered: chart.update()
	foreach comp:
		comp = {Plot or Matrix component constructor}
	foreach comp:
		comp.init()
	foreach chart_indicator:
		chart_ind.on("update"):
			if chart.rendered:
				if new_bar:
					chart_ind.render()
				else:
					chart_ind.update()

render():

	chart.resize()
	foreach comp:
		comp.render()

save_transform():

resize():

	foreach comp:
		comp.resize()

on_comp_resize(comp):

	foreach comp:
		if {comp is one being resized}:
			comp.destroy()
			comp.render()
		else:
			if {comp is AFTER one being resized}:
				comp.reposition()

render_xlabels(comp):

update_xlabels(comp):

on_comp_anchor_update(comp):

	if chart.rendered:
		comp.reposition()
		comp.update()

update():

	if !chart.rendered: throw error
	chart.resize()

destroy():

#### PLOT_COMPONENT

Constructor:

	{define component properties}

init():

	comp.anchor.on("update"):
		chart.on_comp_anchor_update()
	foreach indicator:
		ind.on("update"):
			if {plot extends outside current scale}:
				if chart.rendered:
					comp.on_scale_changed()
			if chart.rendered:
				if new_bar:
					ind.vis_render()
				else:
					ind.vis_update()

render():

	comp.resize()
	chart.render_xlabels()
	foreach indicator:
		ind.vis_render()

resize():

reposition():

update():

	comp.on_scale_changed()
	chart.update_xlabels()

on_scale_changed():

destroy():

#### MATRIX_COMPONENT

Constructor:

	{define component properties}

init():

	comp.anchor.on("update"):
		chart.on_comp_anchor_update()

	foreach indicator:
		ind.on("update"):
			if chart_rendered:
			    matrix_indicator_render()

render():

	comp.resize()
	chart.render_xlabels()
	comp.update()

	foreach indicator:
		matrix_indicator_render()

resize():

reposition():

update():

	chart.update_xlabels()

destroy():

*matrix_indicator_render()*:
