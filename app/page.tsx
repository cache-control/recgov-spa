'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export default function CampgroundSearch() {
    const [ campgrounds, setCampgrounds ] = useState([]);
    const [ availableSites, setAvailableSites ] = useState([]);
    const [ errorMessage, setErrorMessage ] = useState("");
    const [ campInfo, setCampInfo ] = useState({
        camp: null,
        availableDate: new Date().toISOString().slice(0, 7) + '-01T00%3A00%3A00.000Z',
    });

    const formSchema = z.object({
        keywords: z.string().min(3).max(50),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            keywords: "",
        },
    });

    async function getAvailableSites() {
        const camp = campInfo.camp;
        const campId = camp.entity_id;
        const start = campInfo.availableDate;
        const cacheKey = `${campId},${start}`;

        if (cacheKey in camp == false) {
            let availableSites = [];
            let payload = {};

            try {
                const url = `https://www.recreation.gov/api/camps/availability/campground/${campId}/month?start_date=${start}`;
                let response = await fetch(url);
                payload = await response.json();
            } catch {
                setErrorMessage("Network failure while retrieving campground.");
                return;
            }

            for (let key in payload.campsites) {
                const site = payload.campsites[key];
                let expectedDayAsNum = 0;
                let days = [];
                let contig = [];
                let span = [];

                for (let date in site.availabilities) {
                    if (site.availabilities[date] === 'Available') {
                        const day = date.slice(5,10).replace('-','/');
                        const dayAsNum = Number(day.replace('/',''));

                        days.push(day);

                        // group dates into contiguous blocks
                        if (expectedDayAsNum === 0)
                            expectedDayAsNum = dayAsNum;

                        if (expectedDayAsNum === dayAsNum) {
                            contig.push(day);
                            expectedDayAsNum++;
                        } else {
                            span.push(contig);
                            contig = [ day ];
                            expectedDayAsNum = dayAsNum + 1;
                        }

                    }
                }

                if (contig.length)
                    span.push(contig);

                if (days.length) {
                    let spanColor = "";

                    availableSites.push({
                        site: site.site,
                        loop: site.loop,
                        campsite_id: site.campsite_id,
                        campsite_type: site.campsite_type,
                        days: days.join(","),
                        daysSpan: span.map( (contig,idx) => {
                                spanColor = spanColor.length? "" : "text-blue-800";
                                return <span key={idx} className={spanColor}>{contig.join(",")} </span>
                            } ),
                    });
                }
            }

            camp[cacheKey] = availableSites.sort( (a,b) => a.days.localeCompare(b.days) );
            setCampgrounds( [ ...campgrounds ] );
        }

        setAvailableSites(camp[cacheKey]);
        setErrorMessage(camp[cacheKey].length>0? "":"No reservable campsites.");
    }

    async function onSubmitSearch(value: z.infer<typeof formSchema>) {
        const url = 'https://www.recreation.gov/api/search?exact=false&size=30&q=' + encodeURI(value.keywords);
        let payload = {};

        try {
            let response = await fetch(url);
            payload = await response.json();
        } catch {
            setErrorMessage("Network failure during search.");
            return;
        }

        if ('results' in payload) {
            setErrorMessage("");
            campInfo.camp = null;
            setCampInfo( { ...campInfo } );

            setAvailableSites([]);
            setCampgrounds( () => payload.results.filter(camp => camp.reservable && camp.entity_type==="campground") );
        } else {
            setErrorMessage("No matching campgrounds...");
        }
    }

    function onClickSelectCampground(idx) {
        campInfo.camp = campgrounds.at(idx);
        setCampInfo( { ...campInfo } );
        setErrorMessage();
        getAvailableSites();
    }

    function onClickSetDate(date) {
        campInfo.availableDate =  date;
        setCampInfo( { ...campInfo } );

        setErrorMessage();
        getAvailableSites();
    }

    function SearchForm(params) {
        return (
        <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitSearch)} className="space-y-8">
                    <FormField control={form.control} name="keywords" render={ ({field}) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center justify-center gap-2">
                                    <Input
                                        onFocus={()=>setErrorMessage("")}
                                        className="w-72 p-4 rounded-lg border border-gray-300 shadow-md"
                                        placeholder="keywords (ex: grand canyon)"
                                        {...field}
                                    />
                                    <Button type="submit" variant="outline">Search</Button>
                                </div>
                            </FormControl>
                            <FormMessage>{errorMessage}</FormMessage>
                        </FormItem>
                    )}>
                    </FormField>
                </form>
        </Form>
        );
    }

    function CampgroundPanel(params) {
        if (campgrounds.length < 1) 
            return;

        return (
        <Table className="border">
            <TableHeader>
                <TableRow>
                  <TableHead>Sites</TableHead>
                  <TableHead className="w-[100px]">Name</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Location</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {campgrounds.map( (camp,idx) =>
                <TableRow key={idx}>
                    <TableCell>{camp.campsites_count}</TableCell>
                    {camp===campInfo.camp? 
                    <TableCell className="font-medium bg-blue-200">{camp.name}</TableCell>
                    :<TableCell className="font-medium underline cursor-pointer" onClick={()=>onClickSelectCampground(idx)}>{camp.name}</TableCell>
                    }
                    <TableCell>{camp.parent_name}</TableCell>
                    <TableCell className="text-right">{camp.city}, {camp.state_code}</TableCell>
                </TableRow>
                )
                }
            </TableBody>
        </Table>
        );
    }

    // generate date values for buttons
    const date = new Date();
    const currentMonth = date.getUTCMonth();
    const tabsTrigger = [];

    for (let step = 0; step < 6; step++) {
        date.setUTCMonth(currentMonth + step);
        const isoDate = date.toISOString().slice(0, 7) + '-01T00%3A00%3A00.000Z';
        const monthName = date.toUTCString().split(" ").at(2);
        const key = `step${step}`;

        tabsTrigger.push(<TabsTrigger key={isoDate} value={isoDate} onClick={()=>onClickSetDate(isoDate)}>{monthName}</TabsTrigger>)
    }

    function CampsitePanel() {
        if (! campInfo.camp)
            return;

        return (
        <>
        <Tabs defaultValue={campInfo.availableDate} className="w-[400px] mt-2">
            <TabsList>
                {...tabsTrigger}
            </TabsList>
        </Tabs>

        {availableSites?.length > 0 &&
        <Table className="border p-4 mt-2">
            <TableHeader className="sticky top-0">
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Loop</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Available days</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {availableSites.map( (site,idx) =>
                <TableRow key={idx}>
                    <TableCell className="font-medium underline">
                        <a href={'https://www.recreation.gov/camping/campsites/'+site.campsite_id} target="_blank">{site.site}</a>
                    </TableCell>
                    <TableCell>{site.loop}</TableCell>
                    <TableCell>{site.campsite_type}</TableCell>
                    <TableCell>{site.daysSpan}</TableCell>
                </TableRow>
                )
                }
            </TableBody>
        </Table>
        }
        </>
        );
    }

    // main()
    return (
        <>
            <div className="flex items-center justify-center gap-2 mt-2">
                <SearchForm/>
            </div>

            <div className="m-2">
                <CampgroundPanel/>
                <CampsitePanel/>
            </div>
        </>
    )
}
